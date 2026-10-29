"""Original application collections based on freedesktop desktop-entry categories."""
GROUPS=(('productivity','Productivity',('Office','Utility')),
        ('development','Development',('Development',)),
        ('gaming','Gaming',('Game',)),
        ('system','System tools',('System','Settings')))

def in_collection(app,name):
    if name=='all':return True
    categories=set(app.get('categories',[]))
    return any(categories.intersection(values) for key,_title,values in GROUPS if key==name)
