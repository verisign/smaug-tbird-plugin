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
 * Marius Stübs <marius.stuebs@riseup.net>
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

// smaugCommon.js: shared JS functions for Smaug

// WARNING: This module functions must not be loaded in overlays to standard
// functionality!

Components.utils.import("resource://smaug/smaugCommon.jsm");
Components.utils.import("resource://smaug/commonFuncs.jsm");
Components.utils.import("resource://smaug/keyManagement.jsm");


// The compatible Smgmime version
var gSmgmimeVersion = "1.4";
var gSmaugSvc;
var gSmgPromptSvc;


// Maximum size of message directly processed by Smaug
const SMG_MSG_BUFFER_SIZE = 96000;
const SMG_MSG_HEADER_SIZE = 16000;
const SMG_UNLIMITED_BUFFER_SIZE = -1;

const SMG_KEY_BUFFER_SIZE = 64000;

const SMG_PROCESSINFO_CONTRACTID = "@mozilla.org/xpcom/process-info;1";
const SMG_SMAUG_CONTRACTID    = "@mozdev.org/smaug/smaug;1";
const SMG_STRINGBUNDLE_CONTRACTID = "@mozilla.org/intl/stringbundle;1";
const SMG_LOCAL_FILE_CONTRACTID = "@mozilla.org/file/local;1";
const SMG_DIRSERVICE_CONTRACTID = "@mozilla.org/file/directory_service;1";
const SMG_MIME_CONTRACTID = "@mozilla.org/mime;1";
const SMG_WMEDIATOR_CONTRACTID = "@mozilla.org/rdf/datasource;1?name=window-mediator";
const SMG_ASS_CONTRACTID = "@mozilla.org/appshell/appShellService;1";
const SMG_CLIPBOARD_CONTRACTID = "@mozilla.org/widget/clipboard;1";
const SMG_CLIPBOARD_HELPER_CONTRACTID = "@mozilla.org/widget/clipboardhelper;1";
const SMG_TRANSFERABLE_CONTRACTID = "@mozilla.org/widget/transferable;1";
const SMG_LOCALE_SVC_CONTRACTID = "@mozilla.org/intl/nslocaleservice;1";
const SMG_DATE_FORMAT_CONTRACTID = "@mozilla.org/intl/scriptabledateformat;1";
const SMG_ACCOUNT_MANAGER_CONTRACTID = "@mozilla.org/messenger/account-manager;1";
const SMG_THREAD_MANAGER_CID = "@mozilla.org/thread-manager;1";
const SMG_SIMPLEURI_CONTRACTID   = "@mozilla.org/network/simple-uri;1";
const SMG_SEAMONKEY_ID = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";


const SMG_STANDARD_URL_CONTRACTID = "@mozilla.org/network/standard-url;1";
const SMG_SCRIPTABLEINPUTSTREAM_CONTRACTID = "@mozilla.org/scriptableinputstream;1";
const SMG_BINARYINPUTSTREAM_CONTRACTID = "@mozilla.org/binaryinputstream;1";
const SMG_SAVEASCHARSET_CONTRACTID = "@mozilla.org/intl/saveascharset;1";

const SMG_STREAMCONVERTERSERVICE_CID_STR =
      "{892FFEB0-3F80-11d3-A16C-0050041CAF44}";


const SMG_ISCRIPTABLEUNICODECONVERTER_CONTRACTID = "@mozilla.org/intl/scriptableunicodeconverter";

const SMG_IOSERVICE_CONTRACTID = "@mozilla.org/network/io-service;1";

const SMG_C = Components.classes;
const SMG_I = Components.interfaces;

// Key algorithms
const SMG_KEYTYPE_DSA = 1;
const SMG_KEYTYPE_RSA = 2;


// field ID's of key list (as described in the doc/DETAILS file in the GnuPG distribution)
const SMG_KEY_TRUST=1;
const SMG_KEY_ID = 4;
const SMG_CREATED = 5;
const SMG_EXPIRY = 6;
const SMG_UID_ID = 7;
const SMG_OWNERTRUST = 8;
const SMG_USER_ID = 9;
const SMG_SIG_TYPE = 10;
const SMG_KEY_USE_FOR = 11;

const SMG_KEY_EXPIRED="e";
const SMG_KEY_REVOKED="r";
const SMG_KEY_INVALID="i";
const SMG_KEY_DISABLED="d";
const SMG_KEY_NOT_VALID=SMG_KEY_EXPIRED+SMG_KEY_REVOKED+SMG_KEY_INVALID+SMG_KEY_DISABLED;


// GUI List: The corresponding image to set the "active" flag / checkbox
const SMG_IMG_NOT_SELECTED = "chrome://smaug/content/check0.png";
const SMG_IMG_SELECTED     = "chrome://smaug/content/check1.png";
const SMG_IMG_DISABLED     = "chrome://smaug/content/check2.png";


// Interfaces
const nsIEnigmail               = SMG_I.nsIEnigmail;

// Encryption flags
if (nsIEnigmail) {
  const SMG_SIGN    = nsIEnigmail.SEND_SIGNED;
  const SMG_ENCRYPT = nsIEnigmail.SEND_ENCRYPTED;
  const SMG_ENCRYPT_OR_SIGN = SMG_ENCRYPT | SMG_SIGN;
}

// UsePGPMimeOption values
const PGP_MIME_NEVER    = 0;
const PGP_MIME_POSSIBLE = 1;
const PGP_MIME_ALWAYS   = 2;

const SMG_POSSIBLE_PGPMIME = -2081;
const SMG_PGP_DESKTOP_ATT  = -2082;

var gUsePGPMimeOptionList = ["usePGPMimeNever",
                             "usePGPMimePossible",
                             "usePGPMimeAlways"];

// sending options:
var gSmgEncryptionModel = ["encryptionModelConvenient",
                            "encryptionModelManually"];
var gSmgAcceptedKeys = ["acceptedKeysValid",
                         "acceptedKeysAll"];
var gSmgAutoSendEncrypted = ["autoSendEncryptedNever",
                              "autoSendEncryptedIfKeys"];
var gSmgConfirmBeforeSending = ["confirmBeforeSendingNever",
                                 "confirmBeforeSendingAlways",
                                 "confirmBeforeSendingIfEncrypted",
                                 "confirmBeforeSendingIfNotEncrypted",
                                 "confirmBeforeSendingIfRules"];

const SMG_BUTTON_POS_0           = 1;
const SMG_BUTTON_POS_1           = 1 << 8;
const SMG_BUTTON_POS_2           = 1 << 16;
const SMG_BUTTON_TITLE_IS_STRING = 127;

const SMG_HEADERMODE_KEYID = 0x01;
const SMG_HEADERMODE_URL   = 0x10;



function SmgGetFrame(win, frameName) {
  return SmaugCommon.getFrame(win, frameName);
}

// Initializes smaugCommon
function SmgInitCommon(id) {
   DEBUG_LOG("smaugCommon.js: SmgInitCommon: id="+id+"\n");

   gSmgPromptSvc = smgGetService("@mozilla.org/embedcomp/prompt-service;1", "nsIPromptService");
}


function GetSmaugSvc() {
  if (! gSmaugSvc)
    gSmaugSvc = SmaugCommon.getService(window);
  return gSmaugSvc;
}

// maxBytes == -1 => read everything
function SmgReadURLContents(url, maxBytes) {
  DEBUG_LOG("smaugCommon.js: SmgReadURLContents: url="+url+
            ", "+maxBytes+"\n");

  var ioServ = smgGetService(SMG_IOSERVICE_CONTRACTID, "nsIIOService");
  if (!ioServ)
    throw Components.results.NS_ERROR_FAILURE;

  var fileChannel = ioServ.newChannel(url, null, null);

  var rawInStream = fileChannel.open();

  var inStream = SMG_C[SMG_BINARYINPUTSTREAM_CONTRACTID].createInstance(SMG_I.nsIBinaryInputStream);
  inStream.setInputStream(rawInStream);

  var available = inStream.available();
  if ((maxBytes < 0) || (maxBytes > available))
    maxBytes = available;

  var data = inStream.readBytes(maxBytes);

  inStream.close();

  return data;
}

// maxBytes == -1 => read whole file
function SmgReadFileContents(localFile, maxBytes) {

  DEBUG_LOG("smaugCommon.js: SmgReadFileContents: file="+localFile.leafName+
            ", "+maxBytes+"\n");

  if (!localFile.exists() || !localFile.isReadable())
    throw Components.results.NS_ERROR_FAILURE;

  var ioServ = smgGetService(SMG_IOSERVICE_CONTRACTID, "nsIIOService");
  if (!ioServ)
    throw Components.results.NS_ERROR_FAILURE;

  var fileURI = ioServ.newFileURI(localFile);
  return SmgReadURLContents(fileURI.asciiSpec, maxBytes);

}

///////////////////////////////////////////////////////////////////////////////

function WRITE_LOG(str) {
  SmaugCommon.WRITE_LOG(str);
}

function DEBUG_LOG(str) {
  SmaugCommon.DEBUG_LOG(str);
}

function WARNING_LOG(str) {
  SmaugCommon.WARNING_LOG(str);
}

function ERROR_LOG(str) {
  SmaugCommon.ERROR_LOG(str);
}

function CONSOLE_LOG(str) {
  SmaugCommon.CONSOLE_LOG(str);
}


// write exception information
function SmgWriteException(referenceInfo, ex) {
  SmaugCommon.writeException(referenceInfo, ex);
}

///////////////////////////////////////////////////////////////////////////////

function SmgAlert(mesg) {
  return SmaugCommon.alert(window, mesg);
}

/**
 * Displays an alert dialog with 3-4 optional buttons.
 * checkBoxLabel: if not null, display checkbox with text; the checkbox state is returned in checkedObj
 * button-Labels: use "&" to indicate access key
 *     use "buttonType:label" or ":buttonType" to indicate special button types
 *        (buttonType is one of cancel, help, extra1, extra2)
 * return: 0-2: button Number pressed
 *          -1: ESC or close window button pressed
 *
 */
function SmgLongAlert(mesg, checkBoxLabel, okLabel, labelButton2, labelButton3, checkedObj) {
  return SmaugCommon.longAlert(window, mesg, checkBoxLabel, okLabel, labelButton2, labelButton3, checkedObj);
}

function SmgAlertPref(mesg, prefText) {
  return SmaugCommon.alertPref(window, mesg, prefText);
}

// Confirmation dialog with OK / Cancel buttons (both customizable)
function SmgConfirm(mesg, okLabel, cancelLabel) {
  return SmaugCommon.confirmDlg(window, mesg, okLabel, cancelLabel);
}


function SmgConfirmPref(mesg, prefText, okLabel, cancelLabel) {
  return SmaugCommon.confirmPref(window, mesg, prefText, okLabel, cancelLabel);
}

function SmgError(mesg) {
  return gSmgPromptSvc.alert(window, SmgGetString("smgError"), mesg);
}

function SmgPrefWindow(showBasic, clientType, selectTab) {
  DEBUG_LOG("smaugCommon.js: SmgPrefWindow\n");
  SmaugFuncs.openPrefWindow(window, showBasic, selectTab);
}


function SmgHelpWindow(source) {
  SmaugFuncs.openHelpWindow(source);
}


function SmgDisplayRadioPref(prefName, prefValue, optionElementIds) {
  DEBUG_LOG("smaugCommon.js: SmgDisplayRadioPref: "+prefName+", "+prefValue+"\n");

  if (prefValue >= optionElementIds.length)
    return;

  var groupElement = document.getElementById("smaug_"+prefName);
  var optionElement = document.getElementById(optionElementIds[prefValue]);

  if (groupElement && optionElement) {
    groupElement.selectedItem = optionElement;
    groupElement.value = prefValue;
  }
}

function SmgSetRadioPref(prefName, optionElementIds) {
  DEBUG_LOG("smaugCommon.js: SmgSetRadioPref: "+prefName+"\n");

  try {
    var groupElement = document.getElementById("smaug_"+prefName);
    if (groupElement) {
      var optionElement = groupElement.selectedItem;
      var prefValue = optionElement.value;
      if (prefValue < optionElementIds.length) {
        SmgSetPref(prefName, prefValue);
        groupElement.value = prefValue;
      }
    }
  }
  catch (ex) {}
}

function SmgSavePrefs() {
  return SmaugCommon.savePrefs();
}

function SmgGetPref(prefName) {
  return SmaugCommon.getPref(prefName);
}

function SmgGetDefaultPref(prefName) {
  DEBUG_LOG("smaugCommon.js: SmgGetDefaultPref: prefName="+prefName+"\n");
  var prefValue=null;
  try {
    SmaugCommon.prefBranch.lockPref(prefName);
    prefValue = SmgGetPref(prefName);
    SmaugCommon.prefBranch.unlockPref(prefName);
  }
  catch (ex) {}

  return prefValue;
}

function SmgSetPref(prefName, value) {
  return SmaugCommon.setPref(prefName, value);
}

function SmgGetSignMsg(identity) {
  SmaugFuncs.getSignMsg(identity);
}


function SmgConvertFromUnicode(text, charset) {
  DEBUG_LOG("smaugCommon.js: SmgConvertFromUnicode: "+charset+"\n");

  if (!text)
    return "";

  if (! charset) charset="utf-8";

  // Encode plaintext
  try {
    var unicodeConv = SMG_C[SMG_ISCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(SMG_I.nsIScriptableUnicodeConverter);

    unicodeConv.charset = charset;
    return unicodeConv.ConvertFromUnicode(text);

  } catch (ex) {
    DEBUG_LOG("smaugCommon.js: SmgConvertFromUnicode: caught an exception\n");

    return text;
  }
}


function SmgConvertToUnicode(text, charset) {
  // DEBUG_LOG("smaugCommon.js: SmgConvertToUnicode: "+charset+"\n");

  if (!text || !charset /*|| (charset.toLowerCase() == "iso-8859-1")*/)
    return text;

  // Encode plaintext
  try {
    var unicodeConv = SMG_C[SMG_ISCRIPTABLEUNICODECONVERTER_CONTRACTID].getService(SMG_I.nsIScriptableUnicodeConverter);

    unicodeConv.charset = charset;
    return unicodeConv.ConvertToUnicode(text);

  } catch (ex) {
    DEBUG_LOG("smaugCommon.js: SmgConvertToUnicode: caught an exception while converting'"+text+"' to "+charset+"\n");
    return text;
  }
}

function SmgConvertGpgToUnicode(text) {
  return SmaugCommon.convertGpgToUnicode(text);
}

function SmgFormatFpr(fingerprint) {
  return SmaugFuncs.formatFpr(fingerprint);
}

/////////////////////////
// Console stuff
/////////////////////////


// return the options passed to a window
function SmgGetWindowOptions() {
  var winOptions=[];
  if (window.location.search) {
    var optList=window.location.search.substr(1).split(/\&/);
    for (var i=0; i<optList.length; i++) {
      var anOption=optList[i].split(/\=/);
      winOptions[anOption[0]] = unescape(anOption[1]);
    }
  }
  return winOptions;
}

function SmgRulesEditor() {
  SmaugFuncs.openRulesEditor();
}

function EngmailCardDetails() {
  SmaugFuncs.openCardDetails();
}

function SmgKeygen() {
  SmaugFuncs.openKeyGen();

}

// retrieves a localized string from the smaug.properties stringbundle
function SmgGetString(aStr) {
  var argList = new Array();
  // unfortunately arguments.shift() doesn't work, so we use a workaround

  if (arguments.length > 1)
    for (let i=1; i<arguments.length; i++)
      argList.push(arguments[i]);
  return SmaugCommon.getString(aStr, (arguments.length > 1 ? argList : null));
}

// Remove all quoted strings (and angle brackets) from a list of email
// addresses, returning a list of pure email addresses
function SmgStripEmail(mailAddrs) {
  return SmaugFuncs.stripEmail(mailAddrs);
}


//get path for temporary directory (e.g. /tmp, C:\TEMP)
function SmgGetTempDir() {
  return SmaugCommon.getTempDir();
}

// get the OS platform
function SmgGetOS () {
  return SmaugCommon.getOS();
}

function SmgGetVersion() {
  return SmaugCommon.getVersion();
}

function SmgFilePicker(title, displayDir, save, defaultExtension, defaultName, filterPairs) {
  return SmaugCommon.filePicker(window, title, displayDir, save, defaultExtension,
                                   defaultName, filterPairs);
}

// get keys from keyserver
function SmgDownloadKeys(inputObj, resultObj) {
  return SmaugFuncs.downloadKeys(window, inputObj, resultObj);
}

// create new PGP Rule
function SmgNewRule(emailAddress) {
  return SmaugFuncs.createNewRule(window, emailAddress);
}

function SmgGetTrustCode(keyObj) {
  return SmaugFuncs.getTrustCode(keyObj);
}

// Load the key list into memory
// sortDirection: 1 = ascending / -1 = descending

function SmgLoadKeyList(refresh, keyListObj, sortColumn, sortDirection) {
  return SmaugFuncs.loadKeyList(window, refresh, keyListObj, sortColumn, sortDirection);
}

function SmgEditKeyTrust(userIdArr, keyIdArr) {
  return SmaugFuncs.editKeyTrust(window, userIdArr, keyIdArr);
}


function SmgEditKeyExpiry(userIdArr, keyIdArr) {
  return SmaugFuncs.editKeyExpiry(window, userIdArr, keyIdArr);
}

function SmgDisplayKeyDetails(keyId, refresh) {
  return SmaugFuncs.openKeyDetails(window, keyId, refresh);
}

function SmgSignKey(userId, keyId) {
  return SmaugFuncs.signKey(window, userId, keyId);
}


function SmgChangeKeyPwd(keyId, userId) {

  var smaugSvc = GetSmaugSvc();
  if (!smaugSvc)
    return;

  if (! smaugSvc.useGpgAgent()) {
    // no gpg-agent: open dialog to enter new passphrase
    var inputObj = {
      keyId: keyId,
      userId: userId
    };

    window.openDialog("chrome://smaug/content/smaugChangePasswd.xul",
        "", "dialog,modal,centerscreen", inputObj);
  }
  else {
    // gpg-agent used: gpg-agent will handle everything
    SmaugKeyMgmt.changePassphrase(window, "0x"+keyId, "", "",
      function _changePwdCb(exitCode, errorMsg) {
        if (exitCode != 0) {
          SmgAlert(SmgGetString("changePassFailed")+"\n\n"+errorMsg);
        }
      });
  }
}


function SmgRevokeKey(keyId, userId, callbackFunc) {
  var smaugSvc = GetSmaugSvc();
  if (!smaugSvc)
    return false;

  var userDesc="0x"+keyId.substr(-8,8)+" - "+userId;
  if (!SmgConfirm(SmgGetString("revokeKeyAsk", userDesc), SmgGetString("keyMan.button.revokeKey")))
      return false;

  var tmpDir=SmgGetTempDir();

  try {
    var revFile = SMG_C[SMG_LOCAL_FILE_CONTRACTID].createInstance(SmgGetLocalFileApi());
    revFile.initWithPath(tmpDir);
    if (!(revFile.isDirectory() && revFile.isWritable())) {
      SmgAlert(SmgGetString("noTempDir"));
      return false;
    }
  }
  catch (ex) {}
  revFile.append("revkey.asc");

  SmaugKeyMgmt.genRevokeCert(window, "0x"+keyId, revFile, "0", "",
    function _revokeCertCb(exitCode, errorMsg) {
      if (exitCode != 0) {
        revFile.remove(false);
        SmgAlert(SmgGetString("revokeKeyFailed")+"\n\n"+errorMsg);
        return;
      }
      var errorMsgObj = {};
      var keyList = {};
      var r = smaugSvc.importKeyFromFile(window, revFile, errorMsgObj, keyList);
      revFile.remove(false);
      if (r != 0) {
        SmgAlert(SmgGetString("revokeKeyFailed")+"\n\n"+SmgConvertGpgToUnicode(errorMsgObj.value));
      }
      else {
        SmgAlert(SmgGetString("revokeKeyOk"));
      }
      if (callbackFunc) {
        callbackFunc(r == 0);
      }
    });
    return true;
}

function SmgGetLocalFileApi() {
  return SmaugCommon.getLocalFileApi();
}

function SmgShowPhoto (keyId, userId, photoNumber) {
  SmaugFuncs.showPhoto(window, keyId, userId, photoNumber);
}

function SmgGetFilePath (nsFileObj) {
  return SmaugCommon.getFilePath(nsFileObj);
}

function SmgCreateRevokeCert(keyId, userId, callbackFunc) {
  var defaultFileName = userId.replace(/[\<\>]/g, "");
  defaultFileName += " (0x"+keyId.substr(-8,8)+") rev.asc";
  var outFile = SmgFilePicker(SmgGetString("saveRevokeCertAs"),
                               "", true, "*.asc",
                               defaultFileName,
                               [SmgGetString("asciiArmorFile"), "*.asc"]);
  if (! outFile) return -1;

  var smaugSvc = GetSmaugSvc();
  if (!smaugSvc)
    return -1;

  var errorMsgObj = {};
  SmaugKeyMgmt.genRevokeCert(window, "0x"+keyId, outFile, "1", "",
    function _revokeCertCb(exitCode, errorMsg) {
      if (exitCode != 0) {
        SmgAlert(SmgGetString("revokeCertFailed")+"\n\n"+errorMsg);
      }
      else {
        SmgAlert(SmgGetString("revokeCertOK"));
      }

      if (callbackFunc) callbackFunc(exitCode == 0);
    });
  return 0;
}


// return the label of trust for a given trust code
function SmgGetTrustLabel(trustCode) {
  var keyTrust;
  switch (trustCode) {
  case 'q':
    keyTrust=SmgGetString("keyValid.unknown");
    break;
  case 'i':
    keyTrust=SmgGetString("keyValid.invalid");
    break;
  case 'd':
  case 'D':
    keyTrust=SmgGetString("keyValid.disabled");
    break;
  case 'r':
    keyTrust=SmgGetString("keyValid.revoked");
    break;
  case 'e':
    keyTrust=SmgGetString("keyValid.expired");
    break;
  case 'n':
    keyTrust=SmgGetString("keyTrust.untrusted");
    break;
  case 'm':
    keyTrust=SmgGetString("keyTrust.marginal");
    break;
  case 'f':
    keyTrust=SmgGetString("keyTrust.full");
    break;
  case 'u':
    keyTrust=SmgGetString("keyTrust.ultimate");
    break;
  case 'g':
    keyTrust=SmgGetString("keyTrust.group");
    break;
  case '-':
    keyTrust="-";
    break;
  default:
    keyTrust="";
  }
  return keyTrust;
}

function SmgGetDateTime(dateNum, withDate, withTime) {
  return SmaugCommon.getDateTime(dateNum, withDate, withTime);
}

function smgCreateInstance (aURL, aInterface)
{
  return SMG_C[aURL].createInstance(SMG_I[aInterface]);
}

function smgGetService (aURL, aInterface)
{
  // determine how 'aInterface' is passed and handle accordingly
  switch (typeof(aInterface))
  {
    case "object":
      return SMG_C[aURL].getService(aInterface);
      break;

    case "string":
      return SMG_C[aURL].getService(SMG_I[aInterface]);
      break;

    default:
      return SMG_C[aURL].getService();
  }

  return null;
}

function SmgCollapseAdvanced(obj, attribute, dummy) {
  return SmaugFuncs.collapseAdvanced(obj, attribute, dummy);
}

/**
 * SmgOpenUrlExternally
 *
 * forces a uri to be loaded in an external browser
 *
 * @uri nsIUri object
 */
function SmgOpenUrlExternally(uri) {
  let eps  = SMG_C["@mozilla.org/uriloader/external-protocol-service;1"].
                getService(SMG_I.nsIExternalProtocolService);

  eps.loadUrl(uri, null);
}

function SmgOpenURL(event, hrefObj) {
  var xulAppinfo = SMG_C["@mozilla.org/xre/app-info;1"].getService(SMG_I.nsIXULAppInfo);
  if (xulAppinfo.ID == SMG_SEAMONKEY_ID) return;



  try {
    var ioservice  = SMG_C["@mozilla.org/network/io-service;1"].
                  getService(SMG_I.nsIIOService);
    var iUri = ioservice.newURI(hrefObj.href, null, null);

    SmgOpenUrlExternally(iUri);
    event.preventDefault();
    event.stopPropagation();
  }
  catch (ex) {}
}

function SmgGetHttpUri (aEvent) {

    function hRefForClickEvent(aEvent, aDontCheckInputElement)
    {
      var href;
      var isKeyCommand = (aEvent.type == "command");
      var target =
        isKeyCommand ? document.commandDispatcher.focusedElement : aEvent.target;

      if (target instanceof HTMLAnchorElement ||
          target instanceof HTMLAreaElement   ||
          target instanceof HTMLLinkElement)
      {
        if (target.hasAttribute("href"))
          href = target.href;
      }
      else if (!aDontCheckInputElement && target instanceof HTMLInputElement)
      {
        if (target.form && target.form.action)
          href = target.form.action;
      }
      else
      {
        // we may be nested inside of a link node
        var linkNode = aEvent.originalTarget;
        while (linkNode && !(linkNode instanceof HTMLAnchorElement))
          linkNode = linkNode.parentNode;

        if (linkNode)
          href = linkNode.href;
      }

      return href;
    }

  // getHttpUri main function

  let href = hRefForClickEvent(aEvent);

  SmaugCommon.DEBUG_LOG("smaugAbout.js: interpretHtmlClick: href='"+href+"'\n");

  var ioServ = SmaugCommon.getIoService();
  var uri = ioServ.newURI(href, null, null);

  if (Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                .getService(Components.interfaces.nsIExternalProtocolService)
                .isExposedProtocol(uri.scheme) &&
      (uri.schemeIs("http") || uri.schemeIs("https")))
    return uri;

  return null;
}


/**
 * GUI List: Set the "active" flag and the corresponding image
 */
function SmgSetActive(element, status) {
  if (status >= 0) {
    element.setAttribute("active", status.toString());
  }

  switch (status)
  {
  case 0:
    element.setAttribute("src", SMG_IMG_NOT_SELECTED);
    break;
  case 1:
    element.setAttribute("src", SMG_IMG_SELECTED);
    break;
  case 2:
    element.setAttribute("src", SMG_IMG_DISABLED);
    break;
  default:
    element.setAttribute("active", -1);
  }
}


/**
 * Add each subkey to the GUI list. Use this function if there is a preceeding column with checkboxes.
 *
 * @param  XML-DOM  GUI element, where the keys will be listed.
 * @param  Array    Informations of the current key
 * @param  Integer  Count of all keys (primary + subkeys)
 *
 * The internal logic of this function works so, that the main key is always selected.
 * Also all valid (not expired, not revoked) subkeys are selected. If there is only
 * one subkey, it is also always pre-selected.
 *
 */
function SmgAddSubkeyWithSelectboxes(treeChildren, aLine, keyCount) {
  DEBUG_LOG("smaugCommon.js: SmgAddSubkeyWithSelectboxes("+aLine+")\n");

  var preSelected;
  // Pre-Selection logic:
  if (aLine[1] === "r") {
     // Revoked keys can not be changed.
     preSelected = -1;
  } else {
    if (aLine[0]==="pub") {
      // The primary key is ALWAYS selected.
      preSelected = 1;
    } else if (keyCount === 2) {
      // If only 2 keys are here (primary + 1 subkey) then preSelect them anyway.
      preSelected = 1;
    } else if (aLine[1]==="e") {
      // Expired keys are normally un-selected.
      preSelected = 0;
    } else {
      // A valid subkey is pre-selected.
      preSelected = 1;
    }
  }
  var selectCol=document.createElement("treecell");
  selectCol.setAttribute("id", "indicator");
  SmgSetActive(selectCol, preSelected);


  SmgAddSubkey(treeChildren, aLine, selectCol);
}

/**
 * Add each subkey to the GUI list.
 *
 * @param  XML-DOM          GUI element, where the keys will be listed.
 * @param  Array            Informations of the current key
 * @param  Optional Object  If set, it defines if the row is pre-selected
 *                          (assumed, there is a preceeding select column)
 */
function SmgAddSubkey(treeChildren, aLine, selectCol=false) {
  DEBUG_LOG("smaugCommon.js: SmgAddSubkey("+aLine+")\n");

  // Get expiry state of this subkey
  var expire;
  if (aLine[1]==="r") {
    expire = SmgGetString("keyValid.revoked");
  } else if (aLine[6].length==0) {
    expire = SmgGetString("keyExpiryNever");
  } else {
    expire = SmgGetDateTime(aLine[6], true, false);
  }

  var aRow=document.createElement("treerow");
  var treeItem=document.createElement("treeitem");
  var subkey=SmgGetString(aLine[0]==="sub" ? "keyTypeSubkey" : "keyTypePrimary");
  if (selectCol !== false) {
    aRow.appendChild(selectCol);
  }
  aRow.appendChild(createCell(subkey)); // subkey type
  aRow.appendChild(createCell("0x"+aLine[4].substr(-8,8))); // key id
  aRow.appendChild(createCell(SmgGetString("keyAlgorithm_"+aLine[3]))); // algorithm
  aRow.appendChild(createCell(aLine[2])); // size
  aRow.appendChild(createCell(SmgGetDateTime(aLine[5], true, false))); // created
  aRow.appendChild(createCell(expire)); // expiry

  var usagecodes=aLine[11];
  var usagetext = "";
  var i;
//  e = encrypt
//  s = sign
//  c = certify
//  a = authentication
//  Capital Letters are ignored, as these reflect summary properties of a key

  var singlecode = "";
  for (i=0; i < aLine[11].length; i++) {
    singlecode = aLine[11].substr(i, 1);
    switch (singlecode) {
      case "e":
        if (usagetext.length>0) {
          usagetext = usagetext + ", ";
        }
        usagetext = usagetext + SmgGetString("keyUsageEncrypt");
        break;
      case "s":
        if (usagetext.length>0) {
          usagetext = usagetext + ", ";
        }
        usagetext = usagetext + SmgGetString("keyUsageSign");
        break;
      case "c":
        if (usagetext.length>0) {
          usagetext = usagetext + ", ";
        }
        usagetext = usagetext + SmgGetString("keyUsageCertify");
        break;
      case "a":
        if (usagetext.length>0) {
          usagetext = usagetext + ", ";
        }
        usagetext = usagetext + SmgGetString("keyUsageAuthentication");
        break;
    } // * case *
  } // * for *

  aRow.appendChild(createCell(usagetext)); // usage
  treeItem.appendChild(aRow);
  treeChildren.appendChild(treeItem);
}

/**
 * Receive a GUI List and remove all entries
 *
 * @param  XML-DOM  (it will be changed!)
 */
function SmgCleanGuiList(guiList) {
  while (guiList.firstChild) {
    guiList.removeChild(guiList.firstChild);
  }
}



/**
 * Process the output of GPG and return the key details
 *
 * @param   String  Values separated by colons and linebreaks
 *
 * @return  Object with the following keys:
 *    gUserId: Main user ID
 *    calcTrust,
 *    ownerTrust,
 *    fingerprint,
 *    showPhoto,
 *    uidList: List of Pseudonyms and E-Mail-Addresses,
 *    subkeyList: List of Subkeys
 */
function SmgGetKeyDetails(sigListStr) {
  var gUserId;
  var calcTrust;
  var ownerTrust;
  var fingerprint;
  var uidList = [];
  var subkeyList = [];
  var showPhoto = false;

  var sigList = sigListStr.split(/[\n\r]+/);
  for (var i=0; i < sigList.length; i++) {
    var aLine=sigList[i].split(/:/);
    switch (aLine[0]) {
    case "pub":
      gUserId=SmgConvertGpgToUnicode(aLine[9]);
      var calcTrust=aLine[1];
      if (aLine[11].indexOf("D")>=0) {
        calcTrust="d";
      }
      var ownerTrust=aLine[8];
      subkeyList.push(aLine);
    case "uid":
      if (! gUserId) {
        gUserId=SmgConvertGpgToUnicode(aLine[9]);
      }
      else if (uidList !== false) {
        uidList.push(aLine);
      }
      break;
    case "uat":
      // @TODO document what that means
      if (aLine[9].search("1 ") == 0) {
        showPhoto = true;
      }
      break;
    case "sub":
      subkeyList.push(aLine);
      break;
    case "fpr":
      if (fingerprint == null) {
        fingerprint = aLine[9];
      }
      break;
    }
  }

  var keyDetails = {
    gUserId: gUserId,
    calcTrust: calcTrust,
    ownerTrust: ownerTrust,
    fingerprint: fingerprint,
    showPhoto: showPhoto,
    uidList: uidList,
    subkeyList: subkeyList
  };
  return keyDetails;
}

