'use strict';
// Track independent game processes; mutations and stopping stay instance-specific.
class GameSessions {
 constructor(){this.entries=new Map();}
 has(id){return this.entries.has(id);}
 add(id,child,chat){if(this.has(id))throw Error('This instance is already running.');const entry={child,chat,instanceId:id};this.entries.set(id,entry);return entry;}
 finish(id,child){const entry=this.entries.get(id);if(!entry||entry.child!==child)return false;this.entries.delete(id);entry.chat?.dispose();return true;}
 stop(id){const entry=this.entries.get(id);if(!entry)throw Error('This instance is not running.');entry.child.kill();}
 snapshot(extra={}){const sessions=[...this.entries.keys()].map(instanceId=>({instanceId}));return {...extra,running:!!sessions.length,count:sessions.length,sessions};}
}
module.exports={GameSessions};
