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
 * Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.
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
Components.utils.import("resource://smaug/gpgAgentHandler.jsm");

// Initialize smaugCommon
SmgInitCommon("pref-smaug");

var gMimePartsElement, gMimePartsValue, gAdvancedMode;

// saved old manual preferences to switch back
// to them if we temporarily enabled convenient encryption
// (not persistent)
var gSavedManualPrefKeepSettingsForReply = true;
var gSavedManualPrefAcceptedKeys = 1;
var gSavedManualPrefAutoSendEncrypted = 1;
var gSavedManualPrefConfirmBeforeSending = 0;

function displayPrefs(showDefault, showPrefs, setPrefs) {
  DEBUG_LOG("pref-smaug.js displayPrefs\n");

  var s = gSmaugSvc;

  var obj = new Object;
  var prefList = SmaugCommon.prefBranch.getChildList("",obj);

  for (var prefItem in prefList) {
    var prefName=prefList[prefItem];
    var prefElement = document.getElementById("smaug_"+prefName);

    if (prefElement) {
      var prefType = SmaugCommon.prefBranch.getPrefType(prefName);
      var prefValue;
      if (showDefault) {
        prefValue = SmgGetDefaultPref(prefName);
      }
      else {
        prefValue = SmgGetPref(prefName);
      }

      DEBUG_LOG("pref-smaug.js displayPrefs: "+prefName+"="+prefValue+"\n");

      switch (prefType) {
      case SmaugCommon.prefBranch.PREF_BOOL:
        if (showPrefs) {
          if (prefElement.getAttribute("invert") == "true") {
            prefValue = ! prefValue;
          }
          if (prefValue) {
            prefElement.setAttribute("checked", "true");
          } else {
            prefElement.removeAttribute("checked");
          }
        }
        if (setPrefs) {
          if (prefElement.getAttribute("invert") == "true") {
            if (prefElement.checked) {
              SmgSetPref(prefName, false);
            } else {
              SmgSetPref(prefName, true);
            }
          }
          else {
            if (prefElement.checked) {
              SmgSetPref(prefName, true);
            } else {
              SmgSetPref(prefName, false);
            }
          }
        }
        break;

      case SmaugCommon.prefBranch.PREF_INT:
        if (showPrefs) {
          prefElement.value = prefValue;
        }
        if (setPrefs) {
          try {
            SmgSetPref(prefName, 0+prefElement.value);
          } catch (ex) {}
        }
        break;

      case SmaugCommon.prefBranch.PREF_STRING:
        if (showPrefs) {
          prefElement.value = prefValue;
        }
        if (setPrefs) {
          SmgSetPref(prefName, prefElement.value);
        }
        break;

      default:
        DEBUG_LOG("pref-smaug.js displayPrefs: "+prefName+" does not have a type?!\n");
      }
    }
  }
}

function prefOnLoad()
{
  DEBUG_LOG("pref-smaug.js: prefOnLoad()\n");

  GetSmaugSvc();
  displayPrefs(false, true, false);

  document.getElementById("smaug_agentPath").value = SmgConvertToUnicode(SmgGetPref("agentPath"), "utf-8");

  var maxIdle = -1;
  if (! gSmaugSvc) {
    maxIdle = SmaugCommon.getPref("maxIdleMinutes");
  }
  else {
    maxIdle = SmaugGpgAgent.getMaxIdlePref(window);
  }

  document.getElementById("maxIdleMinutes").value = maxIdle;
  gAdvancedMode = SmgGetPref("advancedUser");

  if (window.arguments) {
     if (! window.arguments[0].showBasic) {
         // hide basic tab
         document.getElementById("basic").setAttribute("collapsed", true);
         document.getElementById("basicTab").setAttribute("collapsed", true);
         selectPrefTabPanel("sendingTab");
     }
     else {
       SmgCollapseAdvanced(document.getElementById("prefTabBox"), "collapsed", null);
       SmgCollapseAdvanced(document.getElementById("smgPrefTabPanel"), "hidden", null);
       smgShowUserModeButtons(gAdvancedMode);
     }

     if ((typeof window.arguments[0].selectTab)=="string") {
         selectPrefTabPanel(window.arguments[0].selectTab);
     }

  }
  else {
     smgShowUserModeButtons(gAdvancedMode);
  }

  if (! SmaugCommon.gpgAgentIsOptional) {
    document.getElementById("smaug_noPassphrase").setAttribute("collapsed", true);
    document.getElementById("smaug_useGpgAgent").setAttribute("collapsed", true);
  }

  if ((! window.arguments) || (window.arguments[0].clientType!="seamonkey")) {
    SmgCollapseAdvanced(document.getElementById("prefTabBox"), "collapsed", null);
    SmgCollapseAdvanced(document.getElementById("smgPrefTabPanel"), "hidden", null);
  }

  // init "saved manual preferences" with current settings:
  gSavedManualPrefKeepSettingsForReply = SmgGetPref("keepSettingsForReply");
  gSavedManualPrefAcceptedKeys = SmgGetPref("acceptedKeys");
  gSavedManualPrefAutoSendEncrypted = SmgGetPref("autoSendEncrypted");
  gSavedManualPrefConfirmBeforeSending = SmgGetPref("confirmBeforeSending");
  gSmgEncryptionModel = SmgGetPref("encryptionModel");
  if (gSmgEncryptionModel == 0) { // convenient encryption
    resetSendingPrefsConvenient();
  }
  else {
    resetSendingPrefsManually();
  }

  gMimePartsElement = document.getElementById("mime_parts_on_demand");

  try {
    gMimePartsValue = SmaugCommon.prefRoot.getBoolPref("mail.server.default.mime_parts_on_demand");
  } catch (ex) {
    gMimePartsValue = true;
  }

  if (gMimePartsValue) {
    gMimePartsElement.setAttribute("checked", "true");
  }
  else {
    gMimePartsElement.removeAttribute("checked");
  }

  var overrideGpg = document.getElementById("smgOverrideGpg");
  if (SmgGetPref("agentPath")) {
    overrideGpg.checked = true;
  }
  else {
    overrideGpg.checked = false;
  }
  smgActivateDependent(overrideGpg, "smaug_agentPath smaug_browsePath");

  var testEmailElement = document.getElementById("smaug_test_email");
  var userIdValue = SmgGetPref("userIdValue");

  smgDetermineGpgPath();

  if (testEmailElement && userIdValue) {
    testEmailElement.value = userIdValue;
  }
}

function smgDetermineGpgPath() {
  if (! gSmaugSvc) {
    try {
      gSmaugSvc = SMG_C[SMG_SMAUG_CONTRACTID].createInstance(SMG_I.nsIEnigmail);
      if (! gSmaugSvc.initialized) {
        // attempt to initialize Smaug
        gSmaugSvc.initialize(window, SmgGetVersion(), gPrefSmaug);
      }
    } catch (ex) {}
  }

  if (gSmaugSvc.initialized && typeof(gSmaugSvc.agentPath) == "object") {
    try {
      var agentPath = "";
      if (SmgGetOS() == "WINNT") {
        agentPath = SmgGetFilePath(gSmaugSvc.agentPath).replace(/\\\\/g, "\\");
      }
      else {
        agentPath = gSmaugSvc.agentPath.path;
        // SmgGetFilePath(gSmaugSvc.agentPath); // .replace(/\\\\/g, "\\");
      }
      if (agentPath.length > 50) {
        agentPath = agentPath.substring(0,50)+"...";
      }
      document.getElementById("smaugGpgPath").setAttribute("value", SmgGetString("prefs.gpgFound", agentPath));
    }
    catch(ex) {
      document.getElementById("smaugGpgPath").setAttribute("value", "error 2");
    }
  }
  else {
    document.getElementById("smaugGpgPath").setAttribute("value", SmgGetString("prefs.gpgNotFound"));
  }
}

function selectPrefTabPanel(panelName) {
  var prefTabs=document.getElementById("prefTabs");
  var selectTab=document.getElementById(panelName);
  prefTabs.selectedTab = selectTab;
}

function resetPrefs() {
  DEBUG_LOG("pref-smaug.js: resetPrefs\n");

  displayPrefs(true, true, false);

  SmgSetPref("configuredVersion", SmgGetVersion());

  // init "saved manual preferences" with current settings:
  gSavedManualPrefKeepSettingsForReply = SmgGetPref("keepSettingsForReply");
  gSavedManualPrefAcceptedKeys = SmgGetPref("acceptedKeys");
  gSavedManualPrefAutoSendEncrypted = SmgGetPref("autoSendEncrypted");
  gSavedManualPrefConfirmBeforeSending = SmgGetPref("confirmBeforeSending");
  // and process encryption model:
  gSmgEncryptionModel = SmgGetPref("encryptionModel");
  if (gSmgEncryptionModel == 0) { // convenient encryption
    resetSendingPrefsConvenient();
  }
  else {
    resetSendingPrefsManually();
  }
}

function disableManually (disable)
{
  var elems = [
                "smaug_keepSettingsForReply",
                "acceptedKeysValid",
                "acceptedKeysAll",
                "autoSendEncryptedNever",
                "autoSendEncryptedIfKeys",
                "confirmBeforeSendingNever",
                "confirmBeforeSendingAlways",
                "confirmBeforeSendingIfEncrypted",
                "confirmBeforeSendingIfNotEncrypted",
                "confirmBeforeSendingIfRules",
              ];
  var elem;
  for (var i=0; i < elems.length; ++i) {
    elem = document.getElementById(elems[i]);
    if (disable) {
      elem.setAttribute("disabled","true");
    }
    else {
      elem.removeAttribute("disabled");
    }
  }
}

function updateSendingPrefs()
{
  SmgDisplayRadioPref("acceptedKeys", SmgGetPref("acceptedKeys"),
                       gSmgAcceptedKeys);
  SmgDisplayRadioPref("autoSendEncrypted", SmgGetPref("autoSendEncrypted"),
                       gSmgAutoSendEncrypted);
  SmgDisplayRadioPref("confirmBeforeSending", SmgGetPref("confirmBeforeSending"),
                       gSmgConfirmBeforeSending);
  gSmgEncryptionModel = SmgGetPref("encryptionModel");
  disableManually(gSmgEncryptionModel == 0);
  displayPrefs(false, true, false);
}

function resetSendingPrefsConvenient()
{
  DEBUG_LOG("pref-smaug.js: resetSendingPrefsConvenient()\n");

  // save current manual preferences to be able to switch back to them:
  gSavedManualPrefKeepSettingsForReply = document.getElementById("smaug_keepSettingsForReply").checked;
  gSavedManualPrefAcceptedKeys = document.getElementById("smaug_acceptedKeys").value;
  gSavedManualPrefAutoSendEncrypted = document.getElementById("smaug_autoSendEncrypted").value;
  gSavedManualPrefConfirmBeforeSending = document.getElementById("smaug_confirmBeforeSending").value;

  // switch encryption model:
  gSmgEncryptionModel = 0;       // convenient encryption settings
  SmgSetPref("encryptionModel", gSmgEncryptionModel);

  // update GUI elements and corresponding setting variables:
  var keepSettingsForReply = true;  // reply encrypted on encrypted emails
  gSmgAcceptedKeys = 1;            // all keys accepted
  gSmgAutoSendEncrypted = 1;       // auto.send-encrypted if accepted keys exist
  gSmgConfirmBeforeSending = 0;    // never confirm before sending
  SmgSetPref("keepSettingsForReply", keepSettingsForReply);
  SmgSetPref("acceptedKeys", gSmgAcceptedKeys);
  SmgSetPref("autoSendEncrypted", gSmgAutoSendEncrypted);
  SmgSetPref("confirmBeforeSending", gSmgConfirmBeforeSending);

  updateSendingPrefs();
}

function resetSendingPrefsManually()
{
  DEBUG_LOG("pref-smaug.js: resetSendingPrefsManually()\n");

  // switch encryption model:
  gSmgEncryptionModel = 1;         // manual encryption settings
  SmgSetPref("encryptionModel", gSmgEncryptionModel);

  // update GUI elements and corresponding setting variables
  // with saved old manual preferences:
  var keepSettingsForReply = gSavedManualPrefKeepSettingsForReply;
  gSmgAcceptedKeys = gSavedManualPrefAcceptedKeys;
  gSmgAutoSendEncrypted = gSavedManualPrefAutoSendEncrypted;
  gSmgConfirmBeforeSending = gSavedManualPrefConfirmBeforeSending;
  SmgSetPref("keepSettingsForReply", keepSettingsForReply);
  SmgSetPref("acceptedKeys", gSmgAcceptedKeys);
  SmgSetPref("autoSendEncrypted", gSmgAutoSendEncrypted);
  SmgSetPref("confirmBeforeSending", gSmgConfirmBeforeSending);

  updateSendingPrefs();
}

function resetRememberedValues() {
  DEBUG_LOG("pref-smaug.js: resetRememberedValues\n");
  var prefs=["confirmBeforeSend",
             "displaySignWarn",
             "encryptAttachmentsSkipDlg",
             "initAlert",
             "mimePreferPgp",
             "quotedPrintableWarn",
             "warnOnRulesConflict",
             "warnGpgAgentAndIdleTime",
             "warnClearPassphrase",
             "warnOnSendingNewsgroups",
             "warnDownloadContactKeys",
             "warnIso2022jp",
             "warnRefreshAll"];

  for (var j=0; j<prefs.length; j++) {
    SmgSetPref(prefs[j], SmgGetDefaultPref(prefs[j]));
  }
  SmgAlert(SmgGetString("warningsAreReset"));
}

function prefOnAccept() {

  DEBUG_LOG("pref-smaug.js: prefOnAccept\n");

  var autoKey = document.getElementById("smaug_autoKeyRetrieve").value;

  if (autoKey.search(/.[ ,;\t]./)>=0)  {
    SmgAlert(SmgGetString("prefSmaug.oneKeyserverOnly"));
    return false;
  }

  var oldAgentPath = SmgGetPref("agentPath");

  if (! document.getElementById("smgOverrideGpg").checked) {
    document.getElementById("smaug_agentPath").value = "";
  }
  var newAgentPath = document.getElementById("smaug_agentPath").value;

  displayPrefs(false, false, true);
  SmgSetPref("agentPath", SmgConvertFromUnicode(newAgentPath, "utf-8"));

  if (gMimePartsElement &&
      (gMimePartsElement.checked != gMimePartsValue) ) {

    SmaugCommon.prefRoot.setBoolPref("mail.server.default.mime_parts_on_demand", (gMimePartsElement.checked ? true : false));
  }

  SmgSetPref("configuredVersion", SmgGetVersion());
  SmgSetPref("advancedUser", gAdvancedMode);
  SmaugGpgAgent.setMaxIdlePref(document.getElementById("maxIdleMinutes").value);

  SmgSavePrefs();

  if (oldAgentPath != newAgentPath) {
    if (! gSmaugSvc) {
      try {
        gSmaugSvc = SMG_C[SMG_SMAUG_CONTRACTID].createInstance(SMG_I.nsIEnigmail);
      } catch (ex) {}
    }

    if (gSmaugSvc.initialized) {
      try {
        gSmaugSvc.reinitialize();
      }
      catch (ex) {
        SmgError(SmgGetString("invalidGpgPath"));
      }
    }
    else {
      gSmaugSvc = null;
      GetSmaugSvc();
    }
  }

  // detect use of gpg-agent and warn if needed
  var smaugSvc = GetSmaugSvc();
  if (smaugSvc && smaugSvc.useGpgAgent()) {
    if (!  SmaugGpgAgent.isAgentTypeGpgAgent()) {
      if ((document.getElementById("maxIdleMinutes").value > 0) &&
          (! document.getElementById("smaug_noPassphrase").checked)) {
        SmgAlertPref(SmgGetString("prefs.warnIdleTimeForUnknownAgent"), "warnGpgAgentAndIdleTime");
      }
    }
  }

  // update status bar because whether/how to process rules might have changed
  // NO EFFECT, TB hangs:
  //Smaug.msg.updateStatusBar();

  return true;
}

function smgActivateDependent (obj, dependentIds) {
  var idList = dependentIds.split(/ /);
  var depId;

  for (depId in idList) {
    if (obj.checked) {
      document.getElementById(idList[depId]).removeAttribute("disabled");
    }
    else {
      document.getElementById(idList[depId]).setAttribute("disabled", "true");
    }
  }
  return true;
}

function smgShowUserModeButtons(expertUser) {
  var advUserButton = document.getElementById("smaug_advancedUser");
  var basicUserButton = document.getElementById("smaug_basicUser");
  if (! expertUser) {
    basicUserButton.setAttribute("hidden", true);
    advUserButton.removeAttribute("hidden");
  }
  else {
    advUserButton.setAttribute("hidden", true);
    basicUserButton.removeAttribute("hidden");
  }
}

function smgSwitchAdvancedMode(expertUser) {

  var origPref = SmgGetPref("advancedUser");
  smgShowUserModeButtons(expertUser);
  gAdvancedMode = expertUser;

  if (expertUser) {
    SmgSetPref("advancedUser", true);
  }
  else {
    SmgSetPref("advancedUser", false);
  }

  var prefTabBox  = document.getElementById("prefTabBox");
  if (prefTabBox) {
    // Thunderbird
    SmgCollapseAdvanced(document.getElementById("smgPrefTabPanel"), "hidden", null);
    SmgCollapseAdvanced(prefTabBox, "collapsed", null);
  }
  else {
    // Seamonkey
    SmgCollapseAdvanced(document.getElementById("smaugPrefsBox"), "hidden", null);
  }
  SmgSetPref("advancedUser", origPref);
}

function smgAlertAskNever () {
  SmgAlert(SmgGetString("prefs.warnAskNever"));
}

function activateRulesButton(radioListObj, buttonId) {
  switch (radioListObj.value) {
  case "3":
  case "4":
    document.getElementById(buttonId).setAttribute("disabled", "true");
    break;
  default:
    document.getElementById(buttonId).removeAttribute("disabled");
  }
}


function SmgTest() {
  var plainText = "TEST MESSAGE 123\nTEST MESSAGE 345\n";
  var testEmailElement = document.getElementById("smaug_test_email");
  var toMailAddr = testEmailElement.value;

  var smaugSvc = GetSmaugSvc();
  if (!smaugSvc) {
    SmgAlert(SmgGetString("testNoSvc"));
    return;
  }

  
  /*
  // <EMO>
  var logDir = document.getElementById("logDirectory");
  if (logDir)
  {
    SmgSetPref("logDirectory", SmgConvertFromUnicode(logDir, "utf-8"));
  }
  // </EMO>
  */

  if (!toMailAddr) {

    SmgAlert(SmgGetString("testNoEmail"));
    return;
  }

  try {
    CONSOLE_LOG("\n\nSmgTest: START ********************************\n");
    CONSOLE_LOG("SmgTest: To: "+toMailAddr+"\n"+plainText+"\n");

    var uiFlags = nsIEnigmail.UI_INTERACTIVE;

    var exitCodeObj    = new Object();
    var statusFlagsObj = new Object();
    var errorMsgObj    = new Object();

    var cipherText = smaugSvc.encryptMessage(window, uiFlags, plainText,
                                                toMailAddr, toMailAddr, "",
                                                nsIEnigmail.SEND_SIGNED,
                                                exitCodeObj, statusFlagsObj,
                                                errorMsgObj);
    CONSOLE_LOG("************************************************\n");
    CONSOLE_LOG("SmgTest: SIGNING ONLY\n");
    CONSOLE_LOG("SmgTest: cipherText = "+cipherText+"\n");
    CONSOLE_LOG("SmgTest: exitCode = "+exitCodeObj.value+"\n");
    CONSOLE_LOG("************************************************\n");

    var signatureObj   = new Object();
    var keyIdObj       = new Object();
    var userIdObj      = new Object();
    var sigDetailsObj  = new Object();
    var blockSeparationObj  = new Object();

    var decryptedText = smaugSvc.decryptMessage(window,
                                        uiFlags, cipherText,
                                        signatureObj, exitCodeObj,
                                        statusFlagsObj, keyIdObj, userIdObj,
                                        sigDetailsObj,
                                        errorMsgObj,
                                        blockSeparationObj);

    CONSOLE_LOG("\n************************************************\n");
    CONSOLE_LOG("SmgTest: VERIFICATION\n");
    CONSOLE_LOG("SmgTest: decryptedText = "+decryptedText+"\n");
    CONSOLE_LOG("SmgTest: exitCode  = "+exitCodeObj.value+"\n");
    CONSOLE_LOG("SmgTest: signature = "+signatureObj.value+"\n");
    CONSOLE_LOG("************************************************\n");

    cipherText = smaugSvc.encryptMessage(window, uiFlags, plainText,
                                                toMailAddr, toMailAddr, "",
                                                nsIEnigmail.SEND_SIGNED|
                                                nsIEnigmail.SEND_ENCRYPTED,
                                                exitCodeObj, statusFlagsObj,
                                                errorMsgObj);
    CONSOLE_LOG("************************************************\n");
    CONSOLE_LOG("SmgTest: SIGNING + ENCRYPTION\n");
    CONSOLE_LOG("SmgTest: cipherText = "+cipherText+"\n");
    CONSOLE_LOG("SmgTest: exitCode = "+exitCodeObj.value+"\n");
    CONSOLE_LOG("************************************************\n");

    decryptedText = smaugSvc.decryptMessage(window, uiFlags, cipherText,
                                        signatureObj, exitCodeObj,
                                        statusFlagsObj, keyIdObj, userIdObj,
                                        sigDetailsObj,
                                        errorMsgObj, blockSeparationObj);

    CONSOLE_LOG("\n************************************************\n");
    CONSOLE_LOG("SmgTest: DECRYPTION\n");
    CONSOLE_LOG("SmgTest: decryptedText = "+decryptedText+"\n");
    CONSOLE_LOG("SmgTest: exitCode  = "+exitCodeObj.value+"\n");
    CONSOLE_LOG("SmgTest: signature = "+signatureObj.value+"\n");
    CONSOLE_LOG("************************************************\n");

    SmgAlert(SmgGetString("testSucceeded"));
  }
  catch (ex) {
    SmgAlert(SmgGetString("undefinedError"));
  }
}

function smgLocateGpg() {
  var fileName="gpg";
  var ext="";
  if (SmgGetOS() == "WINNT") {
    ext=".exe";
  }
  var filePath = SmgFilePicker(SmgGetString("locateGpg"),
                           "", false, ext,
                           fileName+ext, null);
  if (filePath) {
//     if (SmaugCommon.getOS() == "WINNT") {
//       document.getElementById("smaug_agentPath").value = SmgGetFilePath(filePath);
//     }
    document.getElementById("smaug_agentPath").value = filePath.path;
  }
}

