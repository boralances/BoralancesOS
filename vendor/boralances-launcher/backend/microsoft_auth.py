"""Validate authentication replies before the vendor library indexes their fields.

The worker handles one request per process. The temporary HTTP guard leaves the
library's PKCE, Xbox and Minecraft protocol intact, and never logs response bodies.
"""
from contextlib import contextmanager
import hmac
import re
from urllib.parse import parse_qs, urlsplit
import requests

STAGES = {
    'callback': 'Microsoft browser callback',
    'microsoft': 'Microsoft token exchange',
    'xbox': 'Xbox Live sign-in',
    'xsts': 'Xbox authorization',
    'minecraft': 'Minecraft service sign-in',
    'profile': 'Minecraft Java profile',
}
ENDPOINTS = {
    ('login.microsoftonline.com', '/consumers/oauth2/v2.0/token'): 'microsoft',
    ('login.live.com', '/oauth20_token.srf'): 'microsoft',
    ('user.auth.xboxlive.com', '/user/authenticate'): 'xbox',
    ('xsts.auth.xboxlive.com', '/xsts/authorize'): 'xsts',
    ('api.minecraftservices.com', '/authentication/login_with_xbox'): 'minecraft',
    ('api.minecraftservices.com', '/minecraft/profile'): 'profile',
}
GUIDANCE = {
    'MS_PUBLIC_CLIENT_REQUIRED': 'Microsoft treated this as a confidential app. Register the callback under Mobile and desktop applications and enable Allow public client flows. This launcher does not use a client secret.',
    'MS_INVALID_CLIENT': 'Check the Application (client) ID and that the app registration supports personal Microsoft accounts.',
    'MS_REDIRECT_MISMATCH': 'Register the exact Local redirect URL under Mobile and desktop applications in your Microsoft app registration.',
    'MS_SCOPE_REJECTED': 'Microsoft rejected the Xbox sign-in scope. Check the application registration and its Xbox/Minecraft API access.',
    'MS_CODE_EXPIRED': 'The sign-in code or session was rejected. Start Sign in with Microsoft again; do not refresh or reuse an old callback page.',
    'MS_REAUTH_REQUIRED': 'The saved Microsoft session expired or was revoked. Sign in with Microsoft again.',
    'CANCELLED': 'Microsoft sign-in was cancelled or consent was denied. Start sign-in again and complete the account and consent screens.',
    'XBOX_PROFILE_REQUIRED': 'This Microsoft account has no Xbox profile. Sign in at xbox.com and finish creating its profile, then retry. This alone does not establish Minecraft ownership.',
    'XBOX_TERMS_REQUIRED': 'Sign in at xbox.com and complete the Xbox terms or account setup, then retry.',
    'XBOX_REGION_RESTRICTED': 'Xbox services rejected this account because of a regional restriction. Check the account with Xbox support.',
    'XBOX_FAMILY_REQUIRED': 'Xbox requires this account to be set up in its Microsoft family. Ask the family organizer to review its Xbox permissions.',
    'XBOX_AGE_VERIFICATION': 'Xbox requires age verification for this account. Complete the verification through Microsoft/Xbox.',
    'XBOX_PLAYTIME_RESTRICTED': 'Xbox reports a playtime restriction for this account. Review the account or family settings.',
    'XBOX_ACCOUNT_RESTRICTED': 'Xbox reports a restriction on this account. Review its Xbox account status and family permissions.',
    'MINECRAFT_APP_REJECTED': 'Minecraft rejected this application registration. The app owner needs to check Minecraft API access/approval for this client ID.',
    'PROFILE_MISSING': 'No Minecraft Java profile was found. Check this account has Java Edition access and has created its Java profile at minecraft.net. This is separate from Microsoft sign-in.',
    'PROVIDER_REJECTED': 'The service rejected sign-in. The stage and service code below identify where it stopped.',
    'SERVICE_UNAVAILABLE': 'The sign-in service is temporarily unavailable or rate limited. Wait and try again.',
    'NETWORK_ERROR': 'The sign-in service could not be reached. Check connectivity and try again.',
    'INVALID_RESPONSE': 'The sign-in service returned an incomplete or unreadable response. Retry sign-in; this is not a Java runtime error.',
    'INVALID_CALLBACK': 'The browser callback was missing its code or did not match this sign-in attempt. Start sign-in again.',
    'UNEXPECTED_AUTH_ERROR': 'Sign-in could not finish. Retry and use Copy sign-in diagnostics to report the failed stage.',
}
XBOX_CODES = {
    2148916233: 'XBOX_PROFILE_REQUIRED', 2148916234: 'XBOX_TERMS_REQUIRED',
    2148916235: 'XBOX_REGION_RESTRICTED', 2148916236: 'XBOX_AGE_VERIFICATION',
    2148916237: 'XBOX_PLAYTIME_RESTRICTED', 2148916238: 'XBOX_FAMILY_REQUIRED',
    2148916227: 'XBOX_ACCOUNT_RESTRICTED', 2148916229: 'XBOX_ACCOUNT_RESTRICTED',
}


class AuthFailure(ValueError):
    def __init__(self, stage, code, status=None, provider_code=None):
        self.diagnostic = {'stage': stage, 'code': code}
        if type(status) is int and 100 <= status <= 599:
            self.diagnostic['httpStatus'] = status
        if type(provider_code) is int and 0 <= provider_code <= 9999999999:
            self.diagnostic['providerCode'] = provider_code
        parts = [code]
        if 'httpStatus' in self.diagnostic:
            parts.append('HTTP ' + str(status))
        if 'providerCode' in self.diagnostic:
            parts.append(('AADSTS' if stage in ('microsoft', 'callback') else 'XErr ') + str(provider_code))
        super().__init__(STAGES.get(stage, 'Microsoft sign-in') + ' failed [' + ' · '.join(parts) + ']. ' + GUIDANCE[code])


def provider_error(stage, payload, status=None, refreshing=False):
    """Map only known codes; never echo server descriptions, URLs or credentials."""
    payload = payload if isinstance(payload, dict) else {}
    number = None
    code = 'PROVIDER_REJECTED'
    if status == 429 or (type(status) is int and status >= 500):
        return AuthFailure(stage, 'SERVICE_UNAVAILABLE', status)
    if stage in ('microsoft', 'callback'):
        numbers = payload.get('error_codes')
        if isinstance(numbers, list) and numbers and type(numbers[0]) is int:
            number = numbers[0]
        if number is None:
            match = re.search(r'\bAADSTS(\d{4,10})\b', str(payload.get('error_description', ''))[:8192])
            if match:
                number = int(match[1])
        error = payload.get('error')
        if number == 7000218:
            code = 'MS_PUBLIC_CLIENT_REQUIRED'
        elif number == 50011:
            code = 'MS_REDIRECT_MISMATCH'
        elif error == 'invalid_client' or number in (700016, 700011, 7000215):
            code = 'MS_INVALID_CLIENT'
        elif error == 'invalid_scope':
            code = 'MS_SCOPE_REJECTED'
        elif error == 'invalid_grant':
            code = 'MS_REAUTH_REQUIRED' if refreshing else 'MS_CODE_EXPIRED'
        elif error == 'access_denied':
            code = 'CANCELLED'
    elif stage in ('xbox', 'xsts'):
        value = payload.get('XErr')
        if type(value) is int:
            number = value
        code = XBOX_CODES.get(number, code)
    elif stage == 'minecraft':
        # Only an explicit provider message justifies an app-approval diagnosis.
        description = str(payload.get('errorMessage', payload.get('message', '')))[:4096].lower()
        if 'invalid app registration' in description or 'application is not registered' in description:
            code = 'MINECRAFT_APP_REJECTED'
    elif stage == 'profile' and (status == 404 or payload.get('error') == 'NOT_FOUND'):
        code = 'PROFILE_MISSING'
    return AuthFailure(stage, code, status, number)


def callback_code(returned_url, redirect_uri, state):
    returned, expected = urlsplit(returned_url), urlsplit(redirect_uri)
    query = parse_qs(returned.query)
    if (returned.scheme, returned.netloc, returned.path) != (expected.scheme, expected.netloc, expected.path):
        raise AuthFailure('callback', 'INVALID_CALLBACK')
    actual_state = query.get('state', [])
    if not state or len(actual_state) != 1 or not hmac.compare_digest(actual_state[0], state):
        raise AuthFailure('callback', 'INVALID_CALLBACK')
    if 'error' in query:
        raise provider_error('callback', {key: values[0] for key, values in query.items() if values})
    codes = query.get('code', [])
    if len(codes) != 1 or not codes[0]:
        raise AuthFailure('callback', 'INVALID_CALLBACK')
    return codes[0]


@contextmanager
def guarded_replies(previous_refresh=None, progress=lambda stage: None):
    original = requests.sessions.Session.request
    current = {'stage': 'microsoft'}

    def request(session, method, url, **kwargs):
        parsed = urlsplit(url)
        stage = ENDPOINTS.get((parsed.hostname, parsed.path))
        if parsed.scheme != 'https' or not stage:
            raise AuthFailure(current['stage'], 'INVALID_RESPONSE')
        current['stage'] = stage
        progress(stage)
        try:
            response = original(session, method, url, **kwargs)
        except requests.exceptions.RequestException:
            raise AuthFailure(stage, 'NETWORK_ERROR') from None
        status = response.status_code
        try:
            payload = response.json()
        except (ValueError, TypeError):
            raise AuthFailure(stage, 'SERVICE_UNAVAILABLE' if status == 429 or status >= 500 else 'INVALID_RESPONSE', status) from None
        if not isinstance(payload, dict):
            raise AuthFailure(stage, 'INVALID_RESPONSE', status)
        if status >= 400 or payload.get('error') or payload.get('XErr'):
            raise provider_error(stage, payload, status, previous_refresh is not None)
        required = {'microsoft': ['access_token'], 'xbox': ['Token'], 'xsts': ['Token'], 'minecraft': ['access_token'], 'profile': ['id', 'name']}[stage]
        if any(not isinstance(payload.get(field), str) or not payload[field] for field in required):
            raise AuthFailure(stage, 'INVALID_RESPONSE', status)
        if stage == 'xbox':
            claims = payload.get('DisplayClaims')
            users = claims.get('xui') if isinstance(claims, dict) else None
            if not isinstance(users, list) or not users or not isinstance(users[0], dict) or not isinstance(users[0].get('uhs'), str) or not users[0]['uhs']:
                raise AuthFailure(stage, 'INVALID_RESPONSE', status)
        if stage == 'microsoft':
            if not payload.get('refresh_token') and previous_refresh:
                # OAuth refresh replies may omit a new refresh token; retain the old one.
                payload['refresh_token'] = previous_refresh
            if not isinstance(payload.get('refresh_token'), str) or not payload['refresh_token']:
                raise AuthFailure(stage, 'INVALID_RESPONSE', status)
        # Return the already validated object to the library without editing HTTP
        # body bytes or logging them. Response.json is used only in this worker.
        response.json = lambda **_options: payload
        return response

    requests.sessions.Session.request = request
    try:
        yield current
    finally:
        requests.sessions.Session.request = original


def complete(provider, params, refreshing=False, progress=lambda stage: None):
    required = ['clientId', 'refreshToken'] if refreshing else ['clientId', 'url', 'redirectUri', 'state', 'verifier']
    if not isinstance(params, dict) or any(not isinstance(params.get(key), str) or not params[key] for key in required):
        raise AuthFailure('callback', 'INVALID_CALLBACK')
    try:
        code = None if refreshing else callback_code(params['url'], params['redirectUri'], params['state'])
    except AuthFailure:
        raise
    except (ValueError, TypeError):
        raise AuthFailure('callback', 'INVALID_CALLBACK') from None
    with guarded_replies(params.get('refreshToken') if refreshing else None, progress) as current:
        try:
            if refreshing:
                return provider.complete_refresh(params['clientId'], None, None, params['refreshToken'])
            return provider.complete_login(params['clientId'], None, params['redirectUri'], code, params['verifier'])
        except AuthFailure:
            raise
        except Exception:
            raise AuthFailure(current['stage'], 'UNEXPECTED_AUTH_ERROR') from None
