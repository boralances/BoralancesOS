"""Small, testable parsers for live device reports."""
import json

def audio_devices(text):
    values=json.loads(text)
    if not isinstance(values,list):raise ValueError('Expected an audio device list')
    result=[]
    for item in values:
        if not isinstance(item,dict) or not isinstance(item.get('name'),str):continue
        properties=item.get('properties') or {}
        if item['name'].endswith('.monitor') or properties.get('device.class')=='monitor':continue
        result.append((item['name'],item.get('description') or item['name']))
    return result
