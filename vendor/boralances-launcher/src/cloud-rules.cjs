'use strict';
const {assert}=require('./core.cjs');
function launcherRules(uid){
 assert(typeof uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(uid),'Invalid Firebase owner UID.');
 const admin="auth != null && auth.uid === '"+uid+"'";
 return {boralanceslauncher:{
  '.read':false,'.write':false,
  main:{
   name:{$uid:{
    '.read':'auth != null && auth.uid === $uid',
    '.write':'auth != null && auth.uid === $uid',
    '.validate':"newData.hasChildren(['profile'])",
    profile:{name:{'.validate':'newData.isString() && newData.val().length <= 24'},email:{'.validate':'newData.isString() && newData.val() === auth.token.email'}}
   }},
   public:{'.read':true,'.write':admin},
   vouchers:{$hash:{
    '.read':"auth != null && (auth.uid === '"+uid+"' || root.child('boralanceslauncher/main/redemptions').child(auth.uid).child($hash).exists())",
    '.write':admin,
    '.validate':"newData.hasChildren(['product', 'expires'])"
   }},
   redemptions:{$uid:{$hash:{
    '.read':'auth != null && auth.uid === $uid',
    '.write':"auth != null && auth.uid === $uid && !data.exists() && root.child('boralanceslauncher/main/vouchers').child($hash).exists() && root.child('boralanceslauncher/main/vouchers').child($hash).child('expires').val() > now",
    '.validate':"newData.hasChildren(['redeemedAt']) && newData.child('redeemedAt').isNumber()"
   }}},
   entitlements:{$uid:{$product:{
    '.read':'auth != null && auth.uid === $uid',
    '.write':"auth != null && auth.uid === $uid && !data.exists() && newData.hasChildren(['voucher']) && root.child('boralanceslauncher/main/redemptions').child($uid).child(newData.child('voucher').val()).exists() && root.child('boralanceslauncher/main/vouchers').child(newData.child('voucher').val()).child('product').val() === $product",
    '.validate':"newData.hasChildren(['voucher']) && newData.child('voucher').isString()"
   }}}
  }
 }};
}
function mergeLauncherRules(existing,uid){
 assert(existing&&typeof existing.rules==='object'&&!Array.isArray(existing.rules),'Choose an existing complete Realtime Database rules JSON document.');
 for(const key of ['.read','.write'])assert(existing.rules[key]===undefined||existing.rules[key]===false||existing.rules[key]==='false','Existing root '+key+' grants can override the launcher branch. Review them without replacing other applications.');
 return {...existing,rules:{...existing.rules,...launcherRules(uid)}};
}
module.exports={launcherRules,mergeLauncherRules};
