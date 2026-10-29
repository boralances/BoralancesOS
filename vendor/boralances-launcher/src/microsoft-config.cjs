'use strict';
// OAuth application IDs are public identifiers, never client secrets.
const CLIENT_ID='d170656f-f05d-48a4-9a2d-e8ad156ae01f';
const REDIRECT_URI='http://localhost:53682/callback';
function clientId(){return CLIENT_ID;}
module.exports={CLIENT_ID,REDIRECT_URI,clientId};
