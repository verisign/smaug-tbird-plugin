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
 * The Initial Developer of the Original Code is Patrick Brunschwig.
 * Portions created by Patrick Brunschwig <patrick@enigmail.net> are
 * Copyright (C) 2005 Patrick Brunschwig. All Rights Reserved.
 *
 * Contributor(s):
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

Components.utils.import("resource://smaug/smaugCommon.jsm");
Components.utils.import("resource://smaug/keyManagement.jsm");
Components.utils.import("resource://smaug/installGnuPG.jsm");

// const Ec is already defined in smaugKeygen.js

var gSmgModifySettings;
var gLastDirection=0;
var gSmgAccountMgr;
var gPubkeyFile = {value: null};
var gSeckeyFile = {value: null};
var gCreateNewKey=false;
var gPrefSmaug;
var gDownoadObj = null;

SmgInitCommon("smaugSetupWizard");

function onLoad() {
  gSmgModifySettings = {
    imapOnDemand: true,
    flowedText: true,
    viewPlainText: true,
    quotedPrintable: true,
    composeHTML: true
  };
  gSmgAccountMgr = Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager);

  fillIdentities('checkbox');
}


function onCancel() {
  if (gKeygenRequest) {
    if (SmgConfirm(SmgGetString("keyAbort"), SmgGetString("keyMan.button.generateKeyAbort"), SmgGetString("keyMan.button.generateKeyContinue"))) {
      smaugKeygenCloseRequest();
      return true;
    }
    else {
      return false;
    }
  }
  else {
    var r=(SmgLongAlert(SmgGetString("setupWizard.reallyCancel"), null, SmgGetString("dlg.button.close"), SmgGetString("dlg.button.continue")) == 0);

    if (r && gDownoadObj) {
      gDownoadObj.abort();
      gDownoadObj = null;
    }

    return r;
  }
}


function setLastPage() {
  var wizard = document.getElementById("smaugSetupWizard");
  if (wizard.currentPage) {
    wizard.setAttribute("lastViewedPage", wizard.currentPage.pageid);
  }
}

function onBack() {
  DEBUG_LOG("onBack");
  gLastDirection=-1;
  setLastPage();
}

function onNext() {
  DEBUG_LOG("onNext");
  gLastDirection=1;
  setLastPage();
  var wizard = document.getElementById("smaugSetupWizard");
  if (wizard.currentPage) {
    switch(wizard.currentPage.pageid) {
    case "pgKeySel":
      wizardSelKey();
      break;
    case "pgWelcome":
      checkGnupgInstallation();
      break;
    case "pgInstallGnuPG":
      checkIdentities();
      break;
    case "pgSettings":
      return loadKeys();
    case "pgKeyCreate":
      return checkPassphrase();
    }
  }
  return true;
}

function getWizard() {
  return document.getElementById("smaugSetupWizard");
}

function setNextPage(pageId) {
  var wizard = getWizard();
  wizard.currentPage.next = pageId;
}

function disableNext(disable) {
  var wizard = getWizard();
  wizard.getButton("next").disabled = disable;
}


function countSelectedId() {
  var idCount=0;
  var node = document.getElementById("idSelection").firstChild;
  while (node) {
    if (node.checked) {
      ++idCount;
    }
    node = node.nextSibling;
  }
  return idCount;
}

function onShowPgInstallGnuPG() {
  var ok = smgGetSvc(true);
  disableNext(!ok);

  if (InstallGnuPG.checkAvailability()) {
    document.getElementById("installBox").removeAttribute("collapsed");
  }
  else {
    document.getElementById("findGpgBox").removeAttribute("collapsed");
  }
}

function checkGnupgInstallation() {
  var wizard = getWizard();
  if (wizard.currentPage.next != "pgNoStart") {

    var s = smgGetSvc(true);
    if (s) {
      setNextPage("pgSelectId");
      checkIdentities();
    }
    else {
      setNextPage("pgInstallGnuPG");
      disableNext(false);
    }
  }
}

function installGnuPG() {
  var progressBox = document.getElementById("progressBox");
  var downloadProgress = document.getElementById("downloadProgress");
  var installLabel = document.getElementById("installLabel");
  var installProgress = document.getElementById("installProgress");
  var btnInstallGnupg = document.getElementById("btnInstallGnupg");
  var btnLocateGnuPG = document.getElementById("btnLocateGnuPG");

  btnInstallGnupg.setAttribute("disabled", true);
  btnLocateGnuPG.setAttribute("disabled", true);
  progressBox.removeAttribute("collapsed");

  InstallGnuPG.startInstaller({
    onStart: function(reqObj) {
      gDownoadObj = reqObj;
    },

    onError: function (errorMessage) {
      if (typeof(errorMessage) == "object") {
        var s = SmgGetString("errorType."+errorMessage.type);
        if (errorMessage.type.startsWith("Security")) {
          s += "\n"+ SmgGetString("setupWizard.downloadForbidden");
        }
        else
          s += "\n"+ SmgGetString("setupWizard.downloadImpossible");

        SmgAlert(s);
      }
      else {
        SmgAlert(SmgGetString(errorMessage));
      }

      this.returnToDownload();
    },

    onWarning: function(message) {
      var ret = false;
      if (message == "hashSumMismatch") {
        ret = SmgConfirm(SmgGetString("setupWizard.hashSumError"), SmgGetString("dlgYes"),
                  SmgGetString("dlgNo"));
      }

      if (! ret) this.returnToDownload();

      return ret;
    },

    onProgress: function(event) {
      if (event.lengthComputable) {
        var percentComplete = event.loaded / event.total * 100;
        downloadProgress.setAttribute("value", percentComplete);
      }
      else {
        downloadProgress.setAttribute("mode", "undetermined");
      }
    },

    onDownloaded: function() {
      gDownoadObj = null;
      downloadProgress.setAttribute("value", 100);
      installLabel.removeAttribute("collapsed");
      installProgress.removeAttribute("collapsed");
    },


    returnToDownload: function() {
      btnInstallGnupg.removeAttribute("disabled");
      btnLocateGnuPG.removeAttribute("disabled");
      progressBox.setAttribute("collapsed", "true");
      downloadProgress.setAttribute("value", 0);
      installLabel.setAttribute("collapsed", "true");
      installProgress.setAttribute("collapsed", "true");
    },

    onLoaded: function() {
      installProgress.setAttribute("value", 100);
      installProgress.setAttribute("mode", "determined");

      document.getElementById("installComplete").removeAttribute("collapsed");

      var origPath = SmgGetPref("agentPath");
      SmgSetPref("agentPath", "");

      var s = smgGetSvc(true);
      if (s) {
        disableNext(false);
      }
      else {
        SmgSetPref("agentPath", origPath);
        this.returnToDownload();
        SmgAlert(SmgGetString("setupWizard.installFailed"));
      }
    }
  });
}

function browseKeyFile(referencedId, referencedVar) {
  var filePath = SmgFilePicker(SmgGetString("importKeyFile"),
                               "", false, "*.asc", "",
                               [SmgGetString("gnupgFile"), "*.asc;*.gpg;*.pgp"]);

  if (filePath) {
    document.getElementById(referencedId).value = SmgGetFilePath(filePath);
    referencedVar.value = filePath;
  }
}

function importKeyFiles() {
  if (document.getElementById("publicKeysFile").value.length == 0) {
    SmgAlert(SmgGetString("setupWizard.specifyFile"));
    return false;
  }

  var importedKeys;
  var exitCode;

  var smaugSvc = smgGetSvc(false);
  if (! smaugSvc) return false;

  var errorMsgObj = {};
  var keyListObj = {};
  exitCode = smaugSvc.importKeyFromFile(window, gPubkeyFile.value, errorMsgObj, keyListObj);
  if (exitCode != 0) {
    SmgAlert(SmgGetString("importKeysFailed")+"\n\n"+errorMsgObj.value);
    return false;
  }
  importedKeys = keyListObj.value;

  if (document.getElementById("privateKeysFile").value.length > 0) {

    exitCode = smaugSvc.importKeyFromFile(window, gSeckeyFile.value, errorMsgObj, keyListObj);
    if (exitCode != 0) {
      SmgAlert(SmgGetString("importKeysFailed")+"\n\n"+errorMsgObj.value);
      return false;
    }
    importedKeys += keyListObj.value;
  }


  exitCode = 0;
  var keyList=importedKeys.split(/;/);
  setKeyTrustNextKey(keyList, 0);

  return true;
}

function setKeyTrustNextKey(keyList, index) {
  Ec.DEBUG_LOG("smaugSetupWizard.js: setKeyTrustNextKey("+index+")\n");

  var aKey = keyList[index].split(/:/);
  if (Number(aKey[1]) & 16) {
    // imported key contains secret key
    SmaugKeyMgmt.setKeyTrust(window, aKey[0], 5,
      function(exitCode, errorMsg) {
        if (exitCode != 0) {
          return;
        }

        ++index;
        if (index < keyList.length) {
          setKeyTrustNextKey(keyList, index);
        }
        else
          loadKeys();
      }
    );
  }
  else {
    ++index;
    if (index < keyList.length) {
      setKeyTrustNextKey(keyList, index);
    }
    else
      loadKeys();
  }
}


function displayKeyCreate() {
  if (gLastDirection == 1) {
    fillIdentities('menulist');
  }

  if (countSelectedId() == 1) {
    var node = document.getElementById("idSelection").firstChild;
    while (node) {
      if (node.checked) {
        var identity = gSmgAccountMgr.getIdentity(node.getAttribute("account-id"));
        var idName = identity.identityName;

        var serverList = queryISupArray(
                getServersForIdentity(gSmgAccountMgr, identity),
                Components.interfaces.nsIMsgIncomingServer);

        if (serverList.length > 0) {
          var inServer = serverList[0];

          idName += " - "+inServer.prettyName;
        }
        document.getElementById("userIdentityLabel").value = idName;
        break;
      }
      node = node.nextSibling;
    }
    document.getElementById("userIdentity").setAttribute("collapsed", "true");
    document.getElementById("userIdentityLabel").removeAttribute("collapsed");

  }
  else {
    document.getElementById("userIdentityLabel").setAttribute("collapsed", "true");
    document.getElementById("userIdentity").removeAttribute("collapsed");
  }
}


function displayKeySel() {
  var uidChildren = document.getElementById("uidSelectionChildren");
  if (document.getElementById("createPgpKey").value=="0") {
    setUseKey();
  }
  else {
    setNewKey();
  }
}


function clearKeyListEntries(){
  // remove all rows
  var treeChildren = document.getElementById("uidSelectionChildren");
  while (treeChildren.firstChild) {
    treeChildren.removeChild(treeChildren.firstChild);
  }
}

function onSetStartNow(doStart) {
  if (doStart) {
    setNextPage("pgSelectId");
  }
  else {
    setNextPage("pgNoStart");
  }
}

function onKeySelected() {
  var wizard = document.getElementById("smaugSetupWizard");
  var uidSel = document.getElementById("uidSelection");
  disableNext(uidSel.view.selection.count == 0);
}

function wizardSetFocus() {
  document.getElementById("startNow").focus();
}

function loadKeys() {
  var wizard = document.getElementById("smaugSetupWizard");

  var smaugSvc = smgGetSvc(false);

  if (!smaugSvc) {
    return false;
  }
  clearKeyListEntries();

  var exitCodeObj = {};
  var statusFlagsObj = {};
  var errorMsgObj = {};
  var keyList = Ec.getSecretKeys(window);
  if (keyList == null) {
    return false;
  }


  if (keyList.length ==0) {
    setNextPage("pgNoKeyFound");
    return true;
  }

  var uidChildren = document.getElementById("uidSelectionChildren");
  for (i=0; i < keyList.length; i++) {
    var item = uidChildren.appendChild( document.createElement('treeitem') );
    item.setAttribute("keyId", keyList[i].id);
    var row = item.appendChild(document.createElement('treerow'));
    var cell = row.appendChild( document.createElement('treecell') );
    cell.setAttribute('label', keyList[i].name);
    cell.setAttribute('observes', "bcKeyEnabled");
    cell = row.appendChild( document.createElement('treecell') );
    cell.setAttribute('label', "0x"+keyList[i].id.substr(-8,8));
    cell.setAttribute('observes', "bcKeyEnabled");
    cell = row.appendChild( document.createElement('treecell') );
    cell.setAttribute('label', keyList[i].created);
    cell.setAttribute('observes', "bcKeyEnabled");
  }
  onKeySelected();
  return true;
}

function smgGetSvc(resetCheck) {
  // Lazy initialization of smaug JS component (for efficiency)
  // variant of GetSmaugSvc function

  if (resetCheck) gSmaugSvc = null;

  if (gSmaugSvc) {
    return gSmaugSvc.initialized ? gSmaugSvc : null;
  }

  try {
    gSmaugSvc = SMG_C[SMG_SMAUG_CONTRACTID].createInstance(SMG_I.nsIEnigmail);

  } catch (ex) {
    ERROR_LOG("smaugWizard.js: Error in instantiating SmaugService\n");
    return null;
  }

  DEBUG_LOG("smaugWizard.js: gSmaugSvc = "+gSmaugSvc+"\n");

  if (!gSmaugSvc.initialized) {
    // Try to initialize smaug

    if (! gPrefSmaug) {
      SmaugCommon.initPrefService();
      gPrefSmaug = SmaugCommon.prefBranch;
    }

    try {
      // Initialize smaug
      gSmaugSvc.initialize(window, SmgGetVersion(), gPrefSmaug);

      try {
        // Reset alert count to default value
        gPrefSmaug.clearUserPref("initAlert");
      } catch(ex) {}

    } catch (ex) {

      return null;
     }

    var configuredVersion = SmgGetPref("configuredVersion");

    DEBUG_LOG("smaugWizard.js: smgGetSvc: "+configuredVersion+"\n");

  }

  return gSmaugSvc.initialized ? gSmaugSvc : null;
}



function wizardLocateGpg() {
  var fileName = "gpg";
  var ext = "";
  if (Ec.isDosLike()) {
    ext = ".exe";
  }
  var filePath = SmgFilePicker(SmgGetString("locateGpg"),
                           "", false, ext,
                           fileName+ext, null);

  if (filePath) {
    SmgSetPref("agentPath", SmgGetFilePath(filePath));
    var svc = smgGetSvc(true);

    if (! svc) {
      SmgAlert(SmgGetString("setupWizard.invalidGpg"));
    }
    else {
      document.getElementById("gpgFoundBox").removeAttribute("collapsed");
      disableNext(false);
    }
  }

}

function checkPassphrase() {

  var passphrase = smaugCheckPassphrase();
  if (passphrase == null) return false;

  if (passphrase.length < 8) {
    SmgAlert(SmgGetString("passphrase.min8keys"));
    return false;
  }
  return true;

}

function wizardGenKey() {
  var wizard = document.getElementById("smaugSetupWizard");
  var passphrase = document.getElementById("passphrase").value;

  var curId = wizardGetSelectedIdentity();

  var userName = curId.fullName;
  var userEmail = curId.email;

  var ipcRequest = null;
  var listener = {
      onStartRequest: function () {},
      onStopRequest: function(status) {
        wizardKeygenTerminate(status);
      },
      onDataAvailable: function(data) {
        DEBUG_LOG("smaugSetupWizard.js: genKey - onDataAvailable() "+data+"\n");

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
  wizard.getButton("next").disabled = true;
  wizard.getButton("back").disabled = true;

  try {
    gKeygenRequest = Ec.generateKey(window,
                       Ec.convertFromUnicode(userName),
                       "",
                       userEmail,
                       365*5 /* 5 years */,
                       4096,
                       SMG_KEYTYPE_RSA,
                       passphrase,
                       listener);
  } catch (ex) {
    Ec.DEBUG_LOG("smaugSetupWizard.js: genKey - generateKey() failed with "+ex.toString()+"\n"+ex.stack+"\n");
  }

  if (!gKeygenRequest) {
    SmgAlert(SmgGetString("keyGenFailed"));
    wizard.getButton("back").disabled = false;
    return false;
  }

  WRITE_LOG("smaugKeygen.js: Start: gKeygenRequest = "+gKeygenRequest+"\n");
  return false;
}

function wizardSelKey() {
  // use existing key
  var createKey=document.getElementById("createPgpKey");
  if (createKey.value == "0") {
    var uidSel = document.getElementById("uidSelection");
    var currIndex = uidSel.view.selection.currentIndex;
    var currItem = uidSel.view.getItemAtIndex(currIndex);
    gGeneratedKey = currItem.getAttribute("keyId");
  }
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

function countIdentities() {
  var accountManager = Components.classes[SMG_ACCOUNT_MANAGER_CONTRACTID].getService(Components.interfaces.nsIMsgAccountManager);
  var idSupports = accountManager.allIdentities;
  var identities = queryISupArray(idSupports,
                                       Components.interfaces.nsIMsgIdentity);
  return identities.length;
}

function checkIdentities() {
  var wizard = document.getElementById("smaugSetupWizard");

  if (wizard.currentPage.next != "pgNoStart") {
    if (countIdentities() <= 1) {
      setNextPage("pgEncConv");
    }
  }
}


function fillIdentities(fillType)
{
  DEBUG_LOG("smaugSetupWizard.js: fillIdentities\n");

  var defIdentity;
  var parentElement;
  var identities = queryISupArray(gSmgAccountMgr.allIdentities,
                                       Components.interfaces.nsIMsgIdentity);

  if (fillType == "checkbox") {
    parentElement = document.getElementById("idSelection");
  }
  else {
    parentElement = document.getElementById("userIdentityPopup");

    // Find out default identity
    var defIdentities = gSmgAccountMgr.defaultAccount.identities;
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

    if (document.getElementById("activateId").value == "0") {
      // try to match with selected id
      var node = document.getElementById("idSelection").firstChild;
      while (node) {
        if (node.checked) {
          var currId = gSmgAccountMgr.getIdentity(node.getAttribute("account-id"));
          if (currId.key == defIdentity.key) {
            break;
          }
        }
        node = node.nextSibling;
      }

      // default ID wasn't selected, take 1st selected ID
      if (! node) {
        node = document.getElementById("idSelection").firstChild;
        while (node) {
          if (node.checked) {
            defIdentity = gSmgAccountMgr.getIdentity(node.getAttribute("account-id"));
            break;
          }
          node = node.nextSibling;
        }
      }
    }
  }

  var child=parentElement.firstChild;
  while (child) {
    parentElement.removeChild(child);
    child=parentElement.firstChild;
  }

  DEBUG_LOG("smaugSetupWizard.js: fillIdentities: "+identities + "\n");

  var disableId = document.getElementById("activateId").value == "1";
  var selected = false;
  for (var i=0; i<identities.length; i++) {
    var identity = identities[i];

    DEBUG_LOG("id.valid="+identity.valid+"\n");
    if (!identity.valid || !identity.email)
      continue;

    var serverList = queryISupArray(
            getServersForIdentity(gSmgAccountMgr, identity),
            Components.interfaces.nsIMsgIncomingServer);

    if (serverList.length > 0) {
      var inServer = serverList[0];

      var accountName = " - "+inServer.prettyName;

      DEBUG_LOG("smaugKeygen.js: accountName="+accountName+"\n");
      DEBUG_LOG("smaugKeygen.js: email="+identity.email+"\n");

      if (fillType == "checkbox") {
        var item = document.createElement('checkbox');
        item.setAttribute('checked', "true");
        item.setAttribute('disabled', disableId);
        item.setAttribute('oncommand', "checkIdSelection()");
      }
      else {
        item = document.createElement('menuitem');
        item.setAttribute('label', identity.identityName + accountName);
        item.setAttribute('class', 'identity-popup-item');
      }
      item.setAttribute('label', identity.identityName + accountName);
      item.setAttribute('accountname', accountName);
      item.setAttribute('id', "acc-"+identity.key);
      item.setAttribute('account-id', identity.key);
      item.setAttribute('email', identity.email);

      parentElement.appendChild(item);

      if (fillType != "checkbox") {
        // pre-select default ID
        var idList = document.getElementById("userIdentity");
        if (!selected)
          idList.selectedItem = item;
        if (identity.key == defIdentity.key) {
          idList.selectedItem = item;
          selected = true;
        }
      }
    }
  }
}

function wizardGetSelectedIdentity()
{
  var item = document.getElementById("userIdentity").selectedItem;
  var identityKey = item.getAttribute('account-id');

  return gSmgAccountMgr.getIdentity(identityKey);
}

function applyWizardSettings() {
  DEBUG_LOG("smaugSetupWizard.js: applyWizardSettings\n");

  loadLastPage();

  // process encryption settings:
  //  0: convenient encryption
  //  1: by default encrypt (account preference)
  //  2: by default don't encrypt (account preference)
  var convEnc = (document.getElementById("convEncryptMsg").value == "0" ? 0 : 1);
  SmgSetPref("encryptionModel", convEnc);

  if (document.getElementById("activateId").value == "1") {
    var idSupports = gSmgAccountMgr.allIdentities;
    var identities = queryISupArray(idSupports,
                                       Components.interfaces.nsIMsgIdentity);
    for (var i=0; i<identities.length; i++) {
      wizardApplyId(identities[i], gGeneratedKey);
    }
  }
  else {
    var node = document.getElementById("idSelection").firstChild;
    while (node) {
      if (node.checked) {
        var identity = gSmgAccountMgr.getIdentity(node.getAttribute("account-id"));
        wizardApplyId(identity, gGeneratedKey);
      }
      node = node.nextSibling;
    }
  }

  applyMozSetting("imapOnDemand", "mail.server.default.mime_parts_on_demand", false);
  applyMozSetting("flowedText" ,"mailnews.send_plaintext_flowed", false);
  applyMozSetting("quotedPrintable", "mail.strictly_mime", false);
  applyMozSetting("viewPlainText", "mailnews.display.html_as", 1);
  applyMozSetting("viewPlainText", "mailnews.display.prefer_plaintext", true);

  SmgSetPref("configuredVersion", SmgGetVersion());
  SmgSavePrefs();
}

function applyMozSetting(param, preference, newVal)
{
  if (gSmgModifySettings[param]) {
    if (typeof(newVal)=="boolean") {
      SmaugCommon.prefRoot.setBoolPref(preference, newVal);
    }
    else if (typeof(newVal)=="number") {
      SmaugCommon.prefRoot.setIntPref(preference, newVal);
    }
    else if (typeof(newVal)=="string") {
      SmaugCommon.prefRoot.setCharPref(preference, newVal);
    }
  }
}


function wizardApplyId(identity, keyId)
{
  DEBUG_LOG("smaugSetupWizard.js: wizardApplyId: identity.Key="+identity.key+"\n");
  var accountManager = Components.classes[SMG_ACCOUNT_MANAGER_CONTRACTID].getService(Components.interfaces.nsIMsgAccountManager);
  var idServers = getServersForIdentity(accountManager, identity);
  var servers = queryISupArray(idServers ,Components.interfaces.nsIMsgIncomingServer);

  var newsServer = false;
  for (var i=0; i<servers.length; i++) {
    newsServer = (servers[i].localStoreType == "news");
  }

  identity.setBoolAttribute("enablePgp", true);
  identity.setIntAttribute("pgpKeyMode", 1);
  identity.setCharAttribute("pgpkeyId", "0x"+keyId.substr(-8,8));
  identity.setIntAttribute("openPgpHeaderMode", 0);

  // process signing settings:
  // NOTE: option defaultSigningPolicy is an INT
  var signMsg = (document.getElementById("signMsg").value== "1");
  identity.setIntAttribute("defaultSigningPolicy", (signMsg ? 1 : 0));
  identity.setBoolAttribute("pgpSignEncrypted", false);
  identity.setBoolAttribute("pgpSignPlain", false);

  // process encryption settings:
  //  0: convenient encryption (global preference)
  //  1: by default encrypt (account preference)
  //  2: by default don't encrypt (account preference)
  // NOTE: option defaultEncryptionPolicy is an INT
  var encryptMsg = ((!newsServer) && (document.getElementById("convEncryptMsg").value == "1"));
  identity.setIntAttribute("defaultEncryptionPolicy", (encryptMsg ? 1 : 0));

  if ((document.getElementById("changeSettings").value == "1") &&
      gSmgModifySettings["composeHTML"]) {
    identity.setBoolAttribute("compose_html", false);
  }
}


function wizardKeygenTerminate(exitCode)
{
  DEBUG_LOG("smaugSetupWizard.js: wizardKeygenTerminate\n");

  // Give focus to this window
  window.focus();

  gKeygenRequest = null;

  if ((! gGeneratedKey) || gGeneratedKey == KEYGEN_CANCELLED) return;

  var progMeter = document.getElementById("keygenProgress");
  progMeter.setAttribute("value", 100);

  var curId = wizardGetSelectedIdentity();

  if (SmgConfirm(SmgGetString("keygenComplete", curId.email)+"\n\n"+SmgGetString("revokeCertRecommended"), SmgGetString("keyMan.button.generateCert"), SmgGetString("dlg.button.skip"))) {
    SmgCreateRevokeCert(gGeneratedKey, curId.email, wizardKeygenCleanup);
  }
  else
    wizardKeygenCleanup();

}

function wizardKeygenCleanup() {
  DEBUG_LOG("smaugSetupWizard.js: wizardKeygenCleanup\n");
  smaugKeygenCloseRequest();
  var smaugSvc = smgGetSvc(false);
  smaugSvc.invalidateUserIdList();

  var wizard = document.getElementById("smaugSetupWizard");
  wizard.goTo("pgComplete");
}


function disableIdSel(doDisable) {
  var idSelectionBox = document.getElementById("idSelection");
  var node = idSelectionBox.firstChild;
  while (node) {
    node.setAttribute('disabled',doDisable);
    node = node.nextSibling;
  }

  if (doDisable) {
    disableNext(false);
  }
  else {
    checkIdSelection();
  }
}

function checkIdSelection() {
  var node = document.getElementById("idSelection").firstChild;

  disableNext(countSelectedId() < 1);
}

function showPrefDetails() {

  window.openDialog("chrome://smaug/content/smaugWizardPrefs.xul",
            "", "chrome,modal,centerscreen", gSmgModifySettings);
  return true;
}


function loadLastPage() {
  var wizard = document.getElementById("smaugSetupWizard");
  wizard.canRewind=false;
  wizard.getButton("cancel").disabled = true;
}


function setNewKey() {
  setNextPage('pgKeyCreate');
  disableNext(false);
  gCreateNewKey = true;
  document.getElementById("uidSelection").boxObject.element.setAttribute("disabled", "true");
}

function setUseKey() {
  setNextPage('pgSummary');
  gCreateNewKey = false;
  document.getElementById("uidSelection").boxObject.element.removeAttribute("disabled");
  onKeySelected();
}

function setImportKeys() {
  setNextPage('pgKeyImport');
  gCreateNewKey = false;
  disableNext(false);
  document.getElementById("uidSelection").boxObject.element.setAttribute("disabled", "true");
}


// display summary of all wizard actions
function displayActions()
{
  var currItem=0;
  function appendDesc(what) {
    ++currItem;
    var item = document.getElementById("applyDesc"+currItem);
    item.value="\u2013 "+what;
    item.removeAttribute("collapsed");
  }

  var createKey1=document.getElementById("createPgpKey");
  var createKey2=document.getElementById("newPgpKey");

  if (gCreateNewKey ||
      document.getElementById("pgSettings").next == "pgKeyCreate") {
    setNextPage('pgKeygen');
    appendDesc(SmgGetString("setupWizard.createKey"));
  }
  else {
    setNextPage('pgComplete');
    appendDesc(SmgGetString("setupWizard.useKey", gGeneratedKey));
  }

  var descList=document.getElementById("appliedSettings");

  if (countIdentities() >1) {
    if (document.getElementById("activateId").value == "1") {
      appendDesc(SmgGetString("setupWizard.applyAllId"));
    }
    else {
      var idList = "";
      var node = document.getElementById("idSelection").firstChild;
      while (node) {
        if (node.checked) {
          var identity = gSmgAccountMgr.getIdentity(node.getAttribute("account-id"));
          idList+="<"+identity.email+"> ";
        }
        node = node.nextSibling;
      }
      appendDesc(SmgGetString("setupWizard.applySomeId", idList));
    }
  }
  else {
    appendDesc(SmgGetString("setupWizard.applySingleId", idList));
  }

  // preferences from convenient encryption wizard step:
  switch (document.getElementById("convEncryptMsg").value) {
    case "0": // convYes
      appendDesc(SmgGetString("setupWizard.convEncrypt"));
      break;
    case "1": // convEncYes
      appendDesc(SmgGetString("setupWizard.encryptAll"));
      break;
    case "0": // convEncNo
      appendDesc(SmgGetString("setupWizard.encryptNone"));
      break;
  }

  // signing preferences:
  if (document.getElementById("signMsg").value== "1") {
    appendDesc(SmgGetString("setupWizard.signAll"));
  }
  else {
    appendDesc(SmgGetString("setupWizard.signNone"));
  }

  if (document.getElementById("changeSettings").value == "1") {
    if (gSmgModifySettings["imapOnDemand"] &&
        gSmgModifySettings["flowedText"] &&
        gSmgModifySettings["quotedPrintable"] &&
        gSmgModifySettings["viewPlainText"] &&
        gSmgModifySettings["composeHTML"]) {
      appendDesc(SmgGetString("setupWizard.setAllPrefs"));
    }
    else if (gSmgModifySettings["imapOnDemand"] ||
        gSmgModifySettings["flowedText"] ||
        gSmgModifySettings["quotedPrintable"] ||
        gSmgModifySettings["viewPlainText"] ||
        gSmgModifySettings["composeHTML"]) {
      appendDesc(SmgGetString("setupWizard.setSomePrefs"));
    }
    else {
      appendDesc(SmgGetString("setupWizard.setNoPrefs"));
    }
  }
  else {
    appendDesc(SmgGetString("setupWizard.setNoPrefs"));
  }
}

// Helper function
function getServersForIdentity(accMgr, identity) {
  try {
    // Gecko >= 20
    return accMgr.getServersForIdentity(identity);
  }
  catch(ex) {
    // Gecko < 20
    return accMgr.GetServersForIdentity(identity);
  }
}
