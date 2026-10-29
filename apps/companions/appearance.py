"""Bounded appearance values shared by native shell components."""
def number(state,key,default,low,high):
    try:return max(low,min(high,int(state.get(key,default))))
    except (ValueError,TypeError):return default

def surface(state):
    glass=state.get('profile')=='glass';light=state.get('theme')=='light'
    opacity=number(state,'glass-opacity',68,45,95) if glass else 100 if state.get('profile')=='performance' else 84
    radius=number(state,'corner-radius',24 if glass else 16,8,28)
    rgb='237,244,253' if light else '16,25,42'
    return {'glass':glass,'alpha':round(opacity*255/100),'opacity':opacity/100,'radius':radius,'rgb':rgb}
