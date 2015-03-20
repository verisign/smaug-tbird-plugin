/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
 * Copyright (C) 2002 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 * Patrick Brunschwig <patrick@enigmail.net>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

// Uses: chrome://smaug/content/smaugCommon.js
Components.utils.import("resource://smaug/smaugCommon.jsm");

const Ec = SmaugCommon;

// Initialize smaugCommon
SmgInitCommon("smaugKeygen");

var gAccountManager = Components.classes[SMG_ACCOUNT_MANAGER_CONTRACTID].getService(Components.interfaces.nsIMsgAccountManager);

var gUserIdentityList;
var gUserIdentityListPopup;
var gUseForSigning;

var gKeygenRequest;
var gAllData = "";
var gGeneratedKey= null;
var gUsedId;

const KEYGEN_CANCELLED = "cancelled";
const KEYTYPE_DSA = 1;
const KEYTYPE_RSA = 2;

function smaugKeygenLoad() {
  DEBUG_LOG("smaugKeygen.js: Load\n");

  gUserIdentityList      = document.getElementById("userIdentity");
  gUserIdentityListPopup = document.getElementById("userIdentityPopup");
  gUseForSigning     = document.getElementById("useForSigning");

  if (gUserIdentityListPopup) {
    fillIdentityListPopup();
  }
  gUserIdentityList.focus();

  // restore safe setting, which you ALWAYS explicitly have to overrule,
  // if you don't want them:
  // - specify passphrase
  // - specify expiry date
  var noPassphrase = document.getElementById("noPassphrase");
  noPassphrase.checked = false;
  SmgSetPref("noPassphrase", noPassphrase.checked);
  var noExpiry = document.getElementById("noExpiry");
  noExpiry.checked = false;

  smaugKeygenUpdate(true, false);

  var smaugSvc = GetSmaugSvc();
  if (!smaugSvc) {
     SmgAlert(SmgGetString("accessError"));
  }

  if (smaugSvc.agentType != "gpg") {
     SmgAlert(SmgGetString("onlyGPG"));
     return;
  }
}

function smaugOnClose() {
  var closeWin = true;
  if (gKeygenRequest) {
    closeWin = SmgConfirm(SmgGetString("keyAbort"), SmgGetString("keyMan.button.generateKeyAbort"), SmgGetString("keyMan.button.generateKeyContinue"));
  }
  if (closeWin) abortKeyGeneration();
  return closeWin;
}

function smaugKeygenUnload() {
   DEBUG_LOG("smaugKeygen.js: Unload\n");

   smaugKeygenCloseRequest();
}


function smaugKeygenUpdate(getPrefs, setPrefs) {
  DEBUG_LOG("smaugKeygen.js: Update: "+getPrefs+", "+setPrefs+"\n");

  var noPassphrase        = document.getElementById("noPassphrase");
  var noPassphraseChecked = getPrefs ? SmgGetPref("noPassphrase")
                                     : noPassphrase.checked;

  if (setPrefs) {
    SmgSetPref("noPassphrase", noPassphraseChecked);
  }

  noPassphrase.checked = noPassphraseChecked;

  var passphrase1 = document.getElementById("passphrase");
  var passphrase2 = document.getElementById("passphraseRepeat");
  passphrase1.disabled = noPassphraseChecked;
  passphrase2.disabled = noPassphraseChecked;
}

function smaugKeygenTerminate(exitCode) {
  DEBUG_LOG("smaugKeygen.js: Terminate:\n");

  var curId = gUsedId;

  gKeygenRequest = null;

  if ((! gGeneratedKey) || gGeneratedKey == KEYGEN_CANCELLED) {
    if (! gGeneratedKey)
      SmgAlert(SmgGetString("keyGenFailed"));
    return;
  }

  var progMeter = document.getElementById("keygenProgress");
  progMeter.setAttribute("value", 100);

  if (gGeneratedKey) {
     if (gUseForSigning.checked) {
        curId.setBoolAttribute("enablePgp", true);
        curId.setIntAttribute("pgpKeyMode", 1);
        curId.setCharAttribute("pgpkeyId", "0x"+gGeneratedKey.substr(-8,8));

        smaugKeygenUpdate(false, true);

        SmgSavePrefs();

        if (SmgConfirm(SmgGetString("keygenComplete", curId.email)+"\n\n"+SmgGetString("revokeCertRecommended"), SmgGetString("keyMan.button.generateCert"))) {
            SmgCreateRevokeCert(gGeneratedKey, curId.email, closeAndReset);
        }
        else
          closeAndReset();
     }
     else {
       if (SmgConfirm(SmgGetString("genCompleteNoSign")+"\n\n"+SmgGetString("revokeCertRecommended"), SmgGetString("keyMan.button.generateCert"))) {
          SmgCreateRevokeCert(gGeneratedKey, curId.email, closeAndReset);
       }
       else
          closeAndReset();
     }
   }
   else {
      SmgAlert(SmgGetString("keyGenFailed"));
      window.close();
   }
}

function closeAndReset() {
  var smaugSvc = GetSmaugSvc();
  smaugSvc.invalidateUserIdList();
  window.close();
}

// Cleanup
function smaugKeygenCloseRequest() {
   DEBUG_LOG("smaugKeygen.js: CloseRequest\n");

  if (gKeygenRequest) {
    var p = gKeygenRequest;
    gKeygenRequest = null;
    p.kill(false);
  }
}

function smaugCheckPassphrase() {
  var passphraseElement = document.getElementById("passphrase");
  var passphrase2Element = document.getElementById("passphraseRepeat");

  var passphrase = passphraseElement.value;

  if (passphrase != passphrase2Element.value) {
    SmgAlert(SmgGetString("passNoMatch"));
    return null;
  }

  if (passphrase.search(/[\x80-\xFF]/)>=0) {
    SmgAlert(SmgGetString("passCharProblem"));
    return null;
  }
  if ((passphrase.search(/^\s/)==0) || (passphrase.search(/\s$/)>=0)) {
    SmgAlert(SmgGetString("passSpaceProblem"));
    return null;
  }
  return passphrase;
}



function smaugKeygenStart() {
   DEBUG_LOG("smaugKeygen.js: Start\n");


   if (gKeygenRequest) {
      let req = gKeygenRequest.QueryInterface(Components.interfaces.nsIRequest);
      if (req.isPending()) {
         SmgAlert(SmgGetString("genGoing"));
         return;
      }
   }

   gGeneratedKey = null;
   gAllData = "";

   var smaugSvc = GetSmaugSvc();
   if (!smaugSvc) {
      SmgAlert(SmgGetString("accessError"));
      return;
   }

   var passphrase = smaugCheckPassphrase();
   if (passphrase == null) return;

   var noPassphraseElement = document.getElementById("noPassphrase");

   if (!passphrase && !noPassphraseElement.checked) {
      SmgAlert(SmgGetString("passCheckBox"));
      return;
   }

   var commentElement = document.getElementById("keyComment");
   var comment = commentElement.value;

   var noExpiry = document.getElementById("noExpiry");
   var expireInput = document.getElementById("expireInput");
   var timeScale = document.getElementById("timeScale");

   var expiryTime = 0;
   if (! noExpiry.checked) {
      expiryTime = Number(expireInput.value) * Number(timeScale.value);
      if (expiryTime > 36500) {
        SmgAlert(SmgGetString("expiryTooLong"));
        return;
      }
      if (! (expiryTime > 0)) {
        SmgAlert(SmgGetString("expiryTooShort"));
        return;
      }
   }
   var keySize = Number(document.getElementById("keySize").value);
   var keyType = Number(document.getElementById("keyType").value);

   if ((keyType==KEYTYPE_DSA) && (keySize>3072)){
     SmgAlert(SmgGetString("dsaSizeLimit"));
     keySize = 3072;
   }

   var curId = getCurrentIdentity();
   gUsedId = curId;

   var userName = curId.fullName;
   var userEmail = curId.email;

   if (!userName) {
      SmgAlert(SmgGetString("passUserName"));
      return;
   }

   var idString = userName;

   if (comment)
      idString += " (" + comment + ")";

   idString += " <" + userEmail + ">";

   var confirmMsg = SmgGetString("keyConfirm", idString);

   if (!SmgConfirm(confirmMsg, SmgGetString("keyMan.button.generateKey"))) {
     return;
   }

   var proc = null;

   var listener = {
      onStartRequest: function () {},
      onStopRequest: function(status) {
        smaugKeygenTerminate(status);
      },
      onDataAvailable: function(data) {
        DEBUG_LOG("smaugKeygen.js: onDataAvailable() "+data+"\n");

        gAllData += data;
        var keyCreatedIndex = gAllData.indexOf("[GNUPG:] KEY_CREATED");
        if (keyCreatedIndex >0) {
          gGeneratedKey = gAllData.substr(keyCreatedIndex);
          gGeneratedKey = gGeneratedKey.replace(/(.*\[GNUPG:\] KEY_CREATED . )([a-fA-F0-9]+)([\n\r].*)*/, "$2");
          gAllData = gAllData.replace(/\[GNUPG:\] KEY_CREATED . [a-fA-F0-9]+[\n\r]/, "");
        }
        gAllData = gAllData.replace(/[\r\n]*\[GNUPG:\] GOOD_PASSPHRASE/g, "").replace(/([\r\n]*\[GNUPG:\] PROGRESS primegen )(.)( \d+ \d+)/g, "$2");
        var progMeter = document.getElementById("keygenProgress");
        var progValue = Number(progMeter.value);
        progValue += (1+(100-progValue)/200);
        if (progValue >= 95) progValue=10;
        progMeter.setAttribute("value", progValue);
      }
   };

   try {
      gKeygenRequest = Ec.generateKey(window,
                         Ec.convertFromUnicode(userName),
                         Ec.convertFromUnicode(comment),
                         userEmail,
                         expiryTime,
                         keySize,
                         keyType,
                         passphrase,
                         listener);
   } catch (ex) {
      Ec.DEBUG_LOG("smaugKeygen.js: generateKey() failed with "+ex.toString()+"\n"+ex.stack+"\n");
   }

   if (!gKeygenRequest) {
      SmgAlert(SmgGetString("keyGenFailed"));
   }

   WRITE_LOG("smaugKeygen.js: Start: gKeygenRequest = "+gKeygenRequest+"\n");
}

function abortKeyGeneration() {
  gGeneratedKey = KEYGEN_CANCELLED;
  smaugKeygenCloseRequest();
}

function smaugKeygenCancel() {
  DEBUG_LOG("smaugKeygen.js: Cancel\n");
  var closeWin=false;

  if (gKeygenRequest) {
    closeWin = SmgConfirm(SmgGetString("keyAbort"), SmgGetString("keyMan.button.generateKeyAbort"), SmgGetString("keyMan.button.generateKeyContinue"));
    if (closeWin) abortKeyGeneration();
  }
  else {
    closeWin=true;
  }

  if (closeWin) window.close();
}

function onNoExpiry() {
  var noExpiry = document.getElementById("noExpiry");
  var expireInput = document.getElementById("expireInput");
  var timeScale = document.getElementById("timeScale");

  expireInput.disabled=noExpiry.checked;
  timeScale.disabled=noExpiry.checked;
}


function queryISupArray(supportsArray, iid) {
  var result = [];
  var i;
  try {
    // Gecko <= 20
    for (i=0; i<supportsArray.Count(); i++) {
      result.push(supportsArray.GetElementAt(i).QueryInterface(iid));
    }
  }
  catch(ex) {
    // Gecko > 20
    for (i=0; i<supportsArray.length; i++) {
      result.push(supportsArray.queryElementAt(i, iid));
    }
  }

  return result;
}

function getCurrentIdentity()
{
  var item = gUserIdentityList.selectedItem;
  var identityKey = item.getAttribute('id');

  var identity = gAccountManager.getIdentity(identityKey);

  return identity;
}

function fillIdentityListPopup()
{
  DEBUG_LOG("smaugKeygen.js: fillIdentityListPopup\n");

  var idSupports = gAccountManager.allIdentities;
  var identities = queryISupArray(idSupports,
                                       Components.interfaces.nsIMsgIdentity);

  DEBUG_LOG("smaugKeygen.js: fillIdentityListPopup: "+identities + "\n");

  // Default identity
  var defIdentity;
  var defIdentities = gAccountManager.defaultAccount.identities;
  try {
    // Gecko >= 20
    if (defIdentities.length >= 1) {
      defIdentity = defIdentities.queryElementAt(0, Components.interfaces.nsIMsgIdentity);
    } else {
      defIdentity = identities[0];
    }
  }
  catch (ex) {
    // Gecko < 20
    if (defIdentities.Count() >= 1) {
      defIdentity = defIdentities.QueryElementAt(0, Components.interfaces.nsIMsgIdentity);
    } else {
      defIdentity = identities[0];
    }
  }

  DEBUG_LOG("smaugKeygen.js: fillIdentityListPopup: default="+defIdentity.key+"\n");

  var selected = false;
  for (var i=0; i<identities.length; i++) {
    var identity = identities[i];

    DEBUG_LOG("id.valid="+identity.valid+"\n");
    if (!identity.valid || !identity.email)
      continue;

    var serverSupports, inServer;
    try {
      // Gecko >= 20
      serverSupports = gAccountManager.getServersForIdentity(identity);
      if (serverSupports.length > 0) {
        inServer = serverSupports.queryElementAt(0, Components.interfaces.nsIMsgIncomingServer);
      }
    }
    catch (ex) {
      // Gecko < 20
      serverSupports = gAccountManager.GetServersForIdentity(identity);
      if (serverSupports.GetElementAt(0)) {
        inServer = serverSupports.GetElementAt(0).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
      }
    }

    if (inServer) {
      var accountName = " - "+inServer.prettyName;

      DEBUG_LOG("smaugKeygen.js: accountName="+accountName+"\n");
      DEBUG_LOG("smaugKeygen.js: email="+identity.email+"\n");

      var item = document.createElement('menuitem');
//      item.setAttribute('label', identity.identityName);
      item.setAttribute('label', identity.identityName + accountName);
      item.setAttribute('class', 'identity-popup-item');
      item.setAttribute('accountname', accountName);
      item.setAttribute('id', identity.key);
      item.setAttribute('email', identity.email);

      gUserIdentityListPopup.appendChild(item);

      if (!selected)
        gUserIdentityList.selectedItem = item;

      if (identity.key == defIdentity.key) {
        gUserIdentityList.selectedItem = item;
        selected = true;
      }
    }
  }

}
