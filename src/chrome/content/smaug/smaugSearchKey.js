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
 * Copyright (C) 2004 Patrick Brunschwig. All Rights Reserved.
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

// Uses: chrome://smaug/content/smaugCommon.js

Components.utils.import("resource://smaug/smaugCommon.jsm");
const Ec = SmaugCommon;

const INPUT = 0;
const RESULT = 1;

const SMG_DEFAULT_HKP_PORT  = "11371";
const SMG_DEFAULT_HKPS_PORT  = "443";
const SMG_DEFAULT_LDAP_PORT = "389";

const SMG_CONN_TYPE_HTTP    = 1;
const SMG_CONN_TYPE_GPGKEYS = 2;

const KEY_EXPIRED="e";
const KEY_REVOKED="r";
const KEY_INVALID="i";
const KEY_DISABLED="d";
const KEY_NOT_VALID=KEY_EXPIRED+KEY_REVOKED+KEY_INVALID+KEY_DISABLED;

var gErrorData = "";
var gOutputData = "";
var gSmgRequest;
var gAllKeysSelected = 0;

function trim(str) {
  return str.replace(/^(\s*)(.*)/, "$2").replace(/\s+$/,"");
}

function onLoad () {

  window.arguments[RESULT].importedKeys=0;

  var keyserver = window.arguments[INPUT].keyserver;
  var protocol="";
  if (keyserver.search(/^[a-zA-Z0-9\-\_\.]+:\/\//)==0) {
    protocol=keyserver.replace(/^([a-zA-Z0-9\-\_\.]+)(:\/\/.*)/, "$1");
    keyserver=keyserver.replace(/^[a-zA-Z0-9\-\_\.]+:\/\//, "");
  }
  else {
    protocol="hkp";
  }

  var port="";
  switch (protocol) {
  case "hkp":
    port = SMG_DEFAULT_HKP_PORT;
    break;
  case "hkps":
    port = SMG_DEFAULT_HKPS_PORT;
    break;
  case "ldap":
    port = SMG_DEFAULT_LDAP_PORT;
    break;
  }

  var m = keyserver.match(/^(.+)(:)(\d+)$/);
  if (m && m.length==4) {
    keyserver = m[1];
    port = m[3];
  }

  gSmgRequest = {
    searchList: window.arguments[INPUT].searchList,
    keyNum: 0,
    keyserver: keyserver,
    port: port,
    protocol: protocol,
    keyList: [],
    requestType: (Ec.getPref("useGpgKeysTool") ? SMG_CONN_TYPE_GPGKEYS : SMG_CONN_TYPE_HTTP),
    gpgkeysRequest: null,
    progressMeter: document.getElementById("dialog.progress"),
    httpInProgress: false
  };

  gSmgRequest.progressMeter.mode="undetermined";

  if (window.arguments[INPUT].searchList.length == 1 &&
      window.arguments[INPUT].searchList[0].search(/^0x[A-Fa-f0-9]{8,16}$/) == 0) {
      // shrink dialog and start download if just one key ID provided

      gSmgRequest.dlKeyList = window.arguments[INPUT].searchList;
      document.getElementById("keySelGroup").setAttribute("collapsed", "true");
      window.sizeToContent();
      window.resizeBy(0, -320);
      Ec.dispatchEvent(startDownload, 10);
  }
  else {
    switch (gSmgRequest.requestType) {
    case SMG_CONN_TYPE_HTTP:
      smgNewHttpRequest(nsIEnigmail.SEARCH_KEY, smgScanKeys);
      break;
    case SMG_CONN_TYPE_GPGKEYS:
      smgNewGpgKeysRequest(nsIEnigmail.SEARCH_KEY, smgScanKeys);
      break;
    }
  }
  return true;
}


function selectAllKeys () {
  Ec.DEBUG_LOG("smaugSearchKey.js: selectAllkeys\n");
  var keySelList = document.getElementById("smaugKeySel");
  var treeChildren=keySelList.getElementsByAttribute("id", "smaugKeySelChildren")[0];

  gSmgRequest.dlKeyList = [];

  // Toggle flag to select/deselect all when hotkey is pressed repeatedly
  gAllKeysSelected ^= 1;

  var item=treeChildren.firstChild;
  while (item) {
    var aRows = item.getElementsByAttribute("id","indicator");
    if (aRows.length) {
      var elem=aRows[0];
      SmgSetActive(elem, gAllKeysSelected);
    }
    item = item.nextSibling;
  }
}


function onAccept () {
  Ec.DEBUG_LOG("smaugSearchKey.js: onAccept\n");

  var keySelList = document.getElementById("smaugKeySel");
  var treeChildren=keySelList.getElementsByAttribute("id", "smaugKeySelChildren")[0];

  gSmgRequest.dlKeyList = [];
  var item=treeChildren.firstChild;
  while (item) {
    var aRows = item.getElementsByAttribute("id","indicator");
    if (aRows.length) {
      var elem=aRows[0];
      if (elem.getAttribute("active") == "1") {
        gSmgRequest.dlKeyList.push(item.getAttribute("id"));
      }
    }
    item = item.nextSibling;
  }
  return startDownload();
}


function startDownload() {
  Ec.DEBUG_LOG("smaugSearchKey.js: startDownload\n");
  if (gSmgRequest.dlKeyList.length>0) {
    gSmgRequest.progressMeter.value = 0;
    gSmgRequest.progressMeter.mode = "undetermined";
    document.getElementById("progress.box").removeAttribute("hidden");
    document.getElementById("selall-button").setAttribute("hidden", "true");
    document.getElementById("dialog.accept").setAttribute("disabled", "true");
    gSmgRequest.keyNum = 0;
    gSmgRequest.errorTxt="";
    switch (gSmgRequest.requestType) {
    case SMG_CONN_TYPE_HTTP:
      smgNewHttpRequest(nsIEnigmail.DOWNLOAD_KEY, smgImportKeys);
      break;
    case SMG_CONN_TYPE_GPGKEYS:
      smgNewGpgKeysRequest(nsIEnigmail.DOWNLOAD_KEY, smgImportKeys);
      break;
    }

    // do not yet close the window, so that we can display some progress info
    return false;
  }

  return true;
}


function onCancel() {
  Ec.DEBUG_LOG("smaugSearchKey.js: onCancel\n");

  if (gSmgRequest.httpInProgress) {
    // stop download
    try {
      if ((typeof(window.smgHttpReq) == "object") &&
          (window.smgHttpReq.readyState != 4)) {
          window.smgHttpReq.abort();
      }
      gSmgRequest.httpInProgress=false;
    }
    catch (ex) {}
  }

  if (gSmgRequest.gpgkeysRequest) {

    var p = gSmgRequest.gpgkeysRequest;
    gSmgRequest.gpgkeysRequest = null;
    p.kill(false);
  }

  gOutputData = "";
  window.close();
}


function smgStatusError () {
  Ec.DEBUG_LOG("smaugSearchKey.js: smgStatusError\n");
  gSmgRequest.httpInProgress=false;
  Ec.alert(window, Ec.getString("noKeyserverConn", this.channel.originalURI.prePath));
  smgCloseDialog();
}

function smgCloseDialog() {
  if (window.arguments[RESULT].importedKeys > 0) {
    var smaugSvc = GetSmaugSvc();
    smaugSvc.invalidateUserIdList();
  }

  document.getElementById("smaugSearchKeyDlg").cancelDialog();
  window.close();
}

function smgStatusLoaded (event) {
  Ec.DEBUG_LOG("smaugSearchKey.js: smgStatusLoaded\n");

  if (this.status == 200) {
    // de-HTMLize the result
    var htmlTxt = this.responseText.replace(/<([^<>]+)>/g, "");

    this.requestCallbackFunc(SMG_CONN_TYPE_HTTP, htmlTxt);
  }
  else if (this.status == 500 && this.statusText=="OK") {
    this.requestCallbackFunc(SMG_CONN_TYPE_HTTP, "no keys found");
  }
  else if (this.statusText!="OK") {
    Ec.alert(window, Ec.getString("keyDownloadFailed", this.statusText));
    smgCloseDialog();
    return;
  }

}


function smgImportKeys (connType, txt, errorTxt) {
  Ec.DEBUG_LOG("smaugSearchKey.js: smgImportKeys\n");

  gSmgRequest.keyNum++;
  gSmgRequest.progressMeter.mode = "determined";
  gSmgRequest.progressMeter.value = (100 * gSmgRequest.keyNum / gSmgRequest.dlKeyList.length).toFixed(0);

  if (txt.search(/^\[GNUPG:\] IMPORT_RES/m) < 0) {
    if (!smgImportHtmlKeys(txt)) return;
  }
  else if (errorTxt) {
    gSmgRequest.errorTxt +=errorTxt+"\n";
  }

  if (txt.search(/^\[GNUPG:\] IMPORT_RES/m) >= 0) {
    window.arguments[RESULT].importedKeys++;
  }

  if (gSmgRequest.dlKeyList.length > gSmgRequest.keyNum) {
    switch (connType) {
      case SMG_CONN_TYPE_HTTP:
        smgNewHttpRequest(nsIEnigmail.DOWNLOAD_KEY, window.smgHttpReq.requestCallbackFunc);
        break;
      case SMG_CONN_TYPE_GPGKEYS:
        smgNewGpgKeysRequest(nsIEnigmail.DOWNLOAD_KEY, gSmgRequest.callbackFunction);
    }
    return;
  }
  else if (gSmgRequest.errorTxt) {
    Ec.longAlert(window, Ec.convertGpgToUnicode(gSmgRequest.errorTxt));
  }

  gSmgRequest.httpInProgress=false;

  smgCloseDialog();
}

function smgImportHtmlKeys(txt) {
  var errorMsgObj = new Object();

  var smaugSvc = GetSmaugSvc();
  if (! smaugSvc)
    return false;

  var uiFlags = nsIEnigmail.UI_ALLOW_KEY_IMPORT;
  var r = smaugSvc.importKey(window, uiFlags, txt,
                        gSmgRequest.dlKeyList[gSmgRequest.keyNum-1],
                        errorMsgObj);
  if (errorMsgObj.value)
    Ec.alert(window, errorMsgObj.value);
  if (r == 0) {
    window.arguments[RESULT].importedKeys++;
    return true;
  }
  return false;
}


function smgNewHttpRequest(requestType, requestCallbackFunc) {
  Ec.DEBUG_LOG("smaugSearchKey.js: smgNewHttpRequest\n");

  switch (gSmgRequest.protocol) {
  case "hkp":
    gSmgRequest.protocol = "http";
  case "hkps":
    gSmgRequest.protocol = "https";
  case "http":
  case "https":
    break;
  default:
    var msg=Ec.getString("protocolNotSupported", gSmgRequest.protocol);
    if (! Ec.getPref("useGpgKeysTool"))
      msg += " "+Ec.getString("gpgkeysDisabled");
    Ec.alert(window, msg);
    smgCloseDialog();
    return;
  }

  var httpReq = new XMLHttpRequest();
  var reqCommand;
  switch (requestType) {
  case nsIEnigmail.SEARCH_KEY:
    var pubKey = escape("<"+trim(gSmgRequest.searchList[gSmgRequest.keyNum])+">");
    reqCommand = gSmgRequest.protocol+"://"+gSmgRequest.keyserver+":"+gSmgRequest.port+"/pks/lookup?search="+pubKey+"&op=index";
    break;
  case nsIEnigmail.DOWNLOAD_KEY:
    var keyId = escape(trim(gSmgRequest.dlKeyList[gSmgRequest.keyNum]));
    reqCommand = gSmgRequest.protocol+"://"+gSmgRequest.keyserver+":"+gSmgRequest.port+"/pks/lookup?search="+keyId+"&op=get";
    break;
  default:
    Ec.alert(window, "Unknown request type "+requestType);
    return;
  }

  gSmgRequest.httpInProgress=true;
  httpReq.open("GET", reqCommand);
  httpReq.onerror=smgStatusError;
  httpReq.onload=smgStatusLoaded;
  httpReq.requestCallbackFunc = requestCallbackFunc;
  window.smgHttpReq = httpReq;
  httpReq.send("");
}


function smgScanKeys(connType, htmlTxt) {
  Ec.DEBUG_LOG("smaugSearchKey.js: smgScanKeys\n");

  gSmgRequest.keyNum++;
  gSmgRequest.progressMeter.mode = "determined";
  gSmgRequest.progressMeter.value = (100 * gSmgRequest.keyNum / gSmgRequest.searchList.length).toFixed(0);

  switch (connType) {
    case SMG_CONN_TYPE_HTTP:
      // interpret HTML codes (e.g. &lt;)
      var domParser = new DOMParser();
      // needs improvement: result is max. 4096 bytes long!
      var htmlNode = domParser.parseFromString("<p>" + htmlTxt + "</p>", "text/xml");

      if (htmlNode.firstChild.nodeName=="parsererror") {
        Ec.alert(window, "internalError");
        return false;
      }
      smgScanHtmlKeys(htmlNode.firstChild.firstChild.data);
      break;
    case SMG_CONN_TYPE_GPGKEYS:
      smgScanGpgKeys(Ec.convertGpgToUnicode(unescape(htmlTxt)));
      break;
    default:
      Ec.ERROR_LOG("Unkonwn connType: "+connType+"\n");
  }

  if (gSmgRequest.searchList.length > gSmgRequest.keyNum) {
    switch (connType) {
      case SMG_CONN_TYPE_HTTP:
        smgNewHttpRequest(nsIEnigmail.SEARCH_KEY, window.smgHttpReq.requestCallbackFunc);
        break;
      case  SMG_CONN_TYPE_GPGKEYS:
        smgNewGpgKeysRequest(nsIEnigmail.SEARCH_KEY, gSmgRequest.callbackFunction);
    }
    return true;
  }

  gSmgRequest.httpInProgress=false;
  smgPopulateList(gSmgRequest.keyList);
  document.getElementById("progress.box").setAttribute("hidden", "true");
  document.getElementById("selall-button").removeAttribute("hidden");
  if (gSmgRequest.keyList.length == 0) {
    Ec.alert(window, Ec.getString("noKeyFound"));
    smgCloseDialog();
  }

  document.getElementById("dialog.accept").removeAttribute("disabled");

  return true;
}

function smgScanHtmlKeys (txt) {
  Ec.DEBUG_LOG("smaugSearchKey.js: smgScanHtmlKeys\n");

  var lines=txt.split(/(\n\r|\n|\r)/);
  var key;
  for (i=0; i<lines.length; i++) {
    if (lines[i].search(/^\s*pub /)==0) {
      // new key
      if (key) {
        // first, append prev. key to keylist
        gSmgRequest.keyList.push(key);
      }
      key = null;
      var m=lines[i].match(/(\d+[a-zA-Z]?\/)([0-9a-fA-F]+)(\s+[\d\/\-\.]+\s+)(.*)/);
      if (m && m.length>0 ) {
        key={
          keyId: m[2],
          created: m[3],
          uid: [],
          status: ""
        };
        if (m[4].search(/.+<.+@.+>/)>=0) {
          if (! ignoreUid(m[4])) key.uid.push(trim(m[4]));
        }
        else if (m[4].search(/key (revoked|expired|disabled)/i)>=0) {
          Ec.DEBUG_LOG("revoked key id "+m[4]+"\n");
          key=null;
        }
      }
    }
    else {
      // amend to key
      if (key) {
        var uid = trim(lines[i]);
        if (uid.length>0 && ! ignoreUid(uid))
          key.uid.push(uid);
      }
    }
  }

  // append prev. key to keylist
  if (key) {
    gSmgRequest.keyList.push(key);
  }
}


function smgScanGpgKeys(txt) {
  Ec.DEBUG_LOG("smaugSearchKey.js: smgScanGpgKeys\n");
  Ec.DEBUG_LOG("got text: "+txt+"\n");

  var lines=txt.split(/(\r\n|\n|\r)/);
  var outputType=0;
  var key;
  for (var i=0; i<lines.length; i++) {
    if (outputType == 0 && lines[i].search(/^COUNT \d+\s*$/)==0) {
      outputType=1;
      continue;
    }
    if (outputType == 0 && lines[i].search(/^pub:[\da-fA-F]{8}/)==0) {
      outputType=2;
    }
    if (outputType==1 && (lines[i].search(/^([a-fA-F0-9]{8}){1,2}:/))==0) {
      // output from gpgkeys_* protocol version 0
      // new key
      var m=lines[i].split(/:/);
      if (m && m.length>0 ) {
        if (key) {
          if (key.keyId == m[0]) {
            if (! ignoreUid(m[i])) key.uid.push(trim(m[1]));
          }
          else {
            gSmgRequest.keyList.push(key);
            key=null;
          }
        }
        if (! key) {
          var dat=new Date(m[3]*1000);
          var month=String(dat.getMonth()+101).substr(1);
          var day=String(dat.getDate()+100).substr(1);
          key={
            keyId: m[0],
            created: dat.getFullYear()+"-"+month+"-"+day,
            uid: [],
            status: ""

          };
          if (! ignoreUid(m[1])) key.uid.push(m[1]);
        }
      }
    }
    if (outputType==2 && (lines[i].search(/^pub:/))==0) {
      // output from gpgkeys_* protocol version 1
      // new key
      m=lines[i].split(/:/);
      if (m && m.length>1 ) {
        if (key) {
          gSmgRequest.keyList.push(key);
          key=null;
        }
        dat=new Date(m[4]*1000);
        month=String(dat.getMonth()+101).substr(1);
        day=String(dat.getDate()+100).substr(1);
        key={
          keyId: m[1],
          created: dat.getFullYear()+"-"+month+"-"+day,
          uid: [],
          status: (m.length >= 5 ? m[6] : "")
        };
      }
    }
    if (outputType==2 && (lines[i].search(/^uid:.+/))==0) {
      // output from gpgkeys_* protocol version 1
      // uid for key
      m=lines[i].split(/:/);
      if (m && m.length>1 ) {
        if (key && ! ignoreUid(m[1])) key.uid.push(trim(m[1]));
      }
    }
  }

  // append prev. key to keylist
  if (key) {
    gSmgRequest.keyList.push(key);
  }
}

// interaction with gpgkeys_xxx

function smgNewGpgKeysRequest(requestType, callbackFunction) {
  Ec.DEBUG_LOG("smaugSearchkey.js: smgNewGpgKeysRequest\n");

  var smaugSvc = GetSmaugSvc();
  if (!smaugSvc) {
    Ec.alert(window, Ec.getString("accessError"));
    return;
  }

  gSmgRequest.callbackFunction = callbackFunction;
  gSmgRequest.gpgkeysRequest = null;

  gErrorData = "";
  gOutputData = "";

  var procListener = {
    onStopRequest: function (exitCode) {
      smaugGpgkeysTerminate(exitCode);
    },
    onStdoutData: function(data) {
      gOutputData += data;
    },
    onErrorData: function(data) {
      gErrorData += data;
    }
  };

  if (requestType == nsIEnigmail.SEARCH_KEY) {
    var keyValue = gSmgRequest.searchList[gSmgRequest.keyNum];
  }
  else {
    keyValue = gSmgRequest.dlKeyList[gSmgRequest.keyNum];
  }


  var errorMsgObj = {};
  gSmgRequest.gpgkeysRequest = Ec.searchKey(requestType,
                                 gSmgRequest.protocol,
                                 gSmgRequest.keyserver,
                                 gSmgRequest.port,
                                 keyValue,
                                 procListener,
                                 errorMsgObj);

  if (!gSmgRequest.gpgkeysRequest) {
    // calling gpgkeys_xxx failed, let's try builtin http variant
    switch (gSmgRequest.protocol) {
    case "hkp":
    case "http":
    case "https":
      gSmgRequest.requestType = SMG_CONN_TYPE_HTTP;
      smgNewHttpRequest(requestType, smgScanKeys);
      return;
    default:
      Ec.alert(window, Ec.getString("gpgKeysFailed", gSmgRequest.protocol));
      smgCloseDialog();
      return;
    }
  }

  Ec.DEBUG_LOG("smaugSearchkey.js: Start: gSmgRequest.gpgkeysRequest = "+gSmgRequest.gpgkeysRequest+"\n");
}


function smaugGpgkeysTerminate(exitCode) {
  Ec.DEBUG_LOG("smaugSearchkey.js: smaugGpgkeysTerminate: exitCode="+exitCode+"\n");

  gSmgRequest.gpgkeysRequest = null;

  try {
    if (gErrorData.length > 0) {
      Ec.DEBUG_LOG("smaugSearchkey.js: Terminate(): stderr has data:\n");
      Ec.CONSOLE_LOG(gErrorData+"\n");
    }

    exitCode = Ec.fixExitCode(exitCode, 0);

    if (gOutputData.length > 0) {
      gSmgRequest.callbackFunction(SMG_CONN_TYPE_GPGKEYS, gOutputData, gErrorData);
    }

  } catch (ex) {}
}

// GUI related stuff

function smgPopulateList(keyList) {
  Ec.DEBUG_LOG("smaugSearchKey.js: smgPopulateList\n");

  var sortUsers = function (a,b) {
     if (a.uid[0]<b.uid[0]) { return -1; } else {return 1; }
  };

  var sortKeyIds = function (c,d) {
       if (c.keyId<d.keyId) { return -1; } else {return 1; }
  };

  keyList.sort(sortKeyIds);

  // remove duplicates
  var z = 0;
  while (z<keyList.length-1) {
    if (keyList[z].keyId == keyList[z+1].keyId) {
      keyList.splice(z,1);
    }
    else {
      z = z + 1;
    }
  }

  keyList.sort(sortUsers);

  var treeList = document.getElementById("smaugKeySel");
  var treeChildren=treeList.getElementsByAttribute("id", "smaugKeySelChildren")[0];
  var treeItem;

  for (var i=0; i<keyList.length; i++) {
    treeItem = smgUserSelCreateRow(keyList[i].keyId, false, keyList[i].uid[0], keyList[i].created, keyList[i].status);
    if (keyList[i].uid.length>1) {
      treeItem.setAttribute("container", "true");
      var subChildren=document.createElement("treechildren");
      for (j=1; j<keyList[i].uid.length; j++) {
        var subItem=smgUserSelCreateRow(keyList[i].keyId, true, keyList[i].uid[j], "", keyList[i].status);
        subChildren.appendChild(subItem);
      }
      treeItem.appendChild(subChildren);
    }
    treeChildren.appendChild(treeItem);
  }

  if (keyList.length == 1) {
    // activate found item if just one key found
    SmgSetActive(treeItem.firstChild.firstChild, 1);
  }
}

function smgUserSelCreateRow (keyId, subKey, userId, dateField, trustStatus) {
    Ec.DEBUG_LOG("smaugSearchKey.js: smgUserSelCreateRow\n");
    var selectCol=document.createElement("treecell");
    selectCol.setAttribute("id", "indicator");
    var expCol=document.createElement("treecell");
    var userCol=document.createElement("treecell");
    userCol.setAttribute("id", "name");
    if (trustStatus.indexOf(KEY_EXPIRED)>=0) {
      expCol.setAttribute("label", Ec.getString("selKeyExpired", dateField));
    }
    else {
      expCol.setAttribute("label", dateField);
    }

    expCol.setAttribute("id", "expiry");
    userCol.setAttribute("label", userId);
    var keyCol=document.createElement("treecell");
    keyCol.setAttribute("id", "keyid");
    if (subKey) {
      SmgSetActive(selectCol, -1);
      keyCol.setAttribute("label", "");
    }
    else  {
      SmgSetActive(selectCol, 0);
      keyCol.setAttribute("label", keyId.substr(-8));
    }


    var userRow=document.createElement("treerow");
    userRow.appendChild(selectCol);
    userRow.appendChild(userCol);
    userRow.appendChild(expCol);
    userRow.appendChild(keyCol);
    var treeItem=document.createElement("treeitem");
    treeItem.setAttribute("id", "0x"+keyId);

    if (trustStatus.length > 0 && KEY_NOT_VALID.indexOf(trustStatus.charAt(0))>=0) {
      // key invalid, mark it in grey
      for (var node=userRow.firstChild; node; node=node.nextSibling) {
        var attr=node.getAttribute("properties");
        if (typeof(attr)=="string") {
          node.setAttribute("properties", attr+" smgKeyInactive");
        }
        else {
          node.setAttribute("properties", "smgKeyInactive");
        }
      }
    }

    treeItem.appendChild(userRow);
    return treeItem;
}

function smaugKeySelCallback(event) {
  Ec.DEBUG_LOG("smaugSearchKey.js: smaugKeySelCallback\n");

  var Tree = document.getElementById("smaugKeySel");
  var row = {};
  var col = {};
  var elt = {};
  Tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, elt);
  if (row.value == -1)
    return;


  var treeItem = Tree.contentView.getItemAtIndex(row.value);
  Tree.currentItem=treeItem;
  if (col.value.id != "selectionCol")
    return;

  var aRows = treeItem.getElementsByAttribute("id","indicator");

  if (aRows.length) {
    var elem=aRows[0];
    if (elem.getAttribute("active") == "1") {
      SmgSetActive(elem, 0);
    } else if (elem.getAttribute("active") == "0") {
      SmgSetActive(elem, 1);
    }
  }
}

function ignoreUid(uid) {
  const ignoreList = "{Test 555 <sdfg@gga.com>}";
  return (ignoreList.indexOf("{"+trim(uid)+"}") >= 0);
}
