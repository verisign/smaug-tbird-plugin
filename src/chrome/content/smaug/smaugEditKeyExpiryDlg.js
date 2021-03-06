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
 * The Initial Developer of the Original Code is Marius Stübs.
 * Portions created by Marius Stübs <marius.stuebs@riseup.net> are
 * Copyright (C) 2013 Marius Stübs. All Rights Reserved.
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
const Ec = SmaugCommon;

var gAlertPopUpIsOpen = false;


/**
 * The function for when the popup window for changing the key expiry is loaded.
 */
function onLoad() {
  Ec.DEBUG_LOG("smaugEditKeyExpiryDlg.js: onLoad()\n");

  reloadData();
}

/**
 * Display all the subkeys in XUL element "keyListChildren"
 */
function reloadData() {
  var smaugSvc = GetSmaugSvc();
  if (!smaugSvc) {
    SmgAlert(SmgGetString("accessError"));
    window.close();
    return;
  }
  var exitCodeObj = new Object();
  var errorMsgObj = new Object();
  var gKeyId = window.arguments[0].keyId[0];
  var treeChildren = document.getElementById("keyListChildren");

  // clean lists
  SmgCleanGuiList(treeChildren);

  var keyListStr = smaugSvc.getKeySig("0x"+gKeyId, exitCodeObj, errorMsgObj);
  if (exitCodeObj.value == 0) {
    var keyDetails = SmgGetKeyDetails(keyListStr);

    for (var i=0; i < keyDetails.subkeyList.length; i++) {
      SmgAddSubkeyWithSelectboxes(treeChildren, keyDetails.subkeyList[i]);
    }
  }
}

function smaugKeySelCallback(event) {
  Ec.DEBUG_LOG("smaugEditKeyExpiryDlg.js: smaugKeySelCallback\n");

  var Tree = document.getElementById("subkeyList");
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


function processKey(subKeys) {
  Ec.DEBUG_LOG("smaugEditKeyExpiryDlg.js: processKey()\n");

  var noExpiry = document.getElementById("noExpiry").checked;
  var expiryTime = Number(document.getElementById("expireInput").value);
  var timeScale = document.getElementById("timeScale").value;

  SmaugKeyMgmt.setKeyExpiration(
    window,
    window.arguments[0].keyId[0],
    subKeys,
    expiryTime,
    timeScale,
    noExpiry,
    function(exitCode, errorMsg) {
      if (exitCode != 0) {
        Ec.setTimeout(function () {
          Ec.alert(window, Ec.getString("setKeyExpirationDateFailed")+"\n\n"+errorMsg);
        }, 10);
      }
      else {
        window.arguments[1].refresh = true;
        window.close();
      }
    }
  );
}

/**
 * @return  Array  The indexes of the selected subkeys. 0 is the main key.
 */
function getSelectedSubkeys() {
  Ec.DEBUG_LOG("smaugEditKeyExpiryDlg.js: getSelectedSubkeys()\n");

  var keySelList   = document.getElementById("subkeyList");
  var treeChildren = keySelList.getElementsByAttribute("id", "keyListChildren")[0];
  var item=treeChildren.firstChild;
  var selectedSubKeys = [];

  var subkeyNumber = 0;

  while (item) {
    var aRows = item.getElementsByAttribute("id","indicator");
    if (aRows.length) {
      var elem=aRows[0];
      if (elem.getAttribute("active") == "1") {
        selectedSubKeys.push(subkeyNumber);
      }
    }
    subkeyNumber += 1;
    item = item.nextSibling;
  }

  return selectedSubKeys;
}


/**
 * After clicking on the "ok" button ...
 */
function onAccept() {
  Ec.DEBUG_LOG("smaugEditKeyExpiryDlg.js: onAccept()\n");
  if (checkExpirationDate()) {
    subkeys = getSelectedSubkeys();
    if (subkeys.length > 0) {
      processKey(subkeys);
    } else {
      Ec.setTimeout(function () {
        Ec.alert(window, Ec.getString("noKeySelected")+"\n");
      }, 10);
    }
  }
  return false; /* don't close the window now. Wait for calling window.close() explicitly. */
}

function checkExpirationDate() {
  Ec.DEBUG_LOG("smaugEditKeyExpiryDlg.js: checkExpirationDate()\n");

  var noExpiry = document.getElementById("noExpiry");
  var expireInput = document.getElementById("expireInput");
  var timeScale = document.getElementById("timeScale");

  var expiryTime = 0;
  if (! noExpiry.checked) {
    expiryTime = Number(expireInput.value) * Number(timeScale.value);
    if (expiryTime > 90*365) {
      /* alert("You cannot create a key that expires in more than 100 years."); */
      /* @TODO GPG throws an error already when using 95 years (multiplying 365 and 95) */
      if (gAlertPopUpIsOpen !== true) {
        gAlertPopUpIsOpen = true
        Ec.setTimeout(function () {
          Ec.alert(window, Ec.getString("expiryTooLongShorter")+"\n");
          gAlertPopUpIsOpen = false
        }, 10);
      }
      return false;
    }
    else if (! (expiryTime > 0)) {
      /* alert("Your key must be valid for at least one day."); */
      if (gAlertPopUpIsOpen !== true) {
        gAlertPopUpIsOpen = true
        Ec.setTimeout(function () {
          Ec.alert(window, Ec.getString("expiryTooShort")+"\n");
          gAlertPopUpIsOpen = false
        }, 10);
      }
      return false;
    }
  }
  return true;
}

function onNoExpiry() {
  Ec.DEBUG_LOG("smaugEditKeyExpiryDlg.js: onNoExpiry()\n");

  var noExpiry = document.getElementById("noExpiry");
  var expireInput = document.getElementById("expireInput");
  var timeScale = document.getElementById("timeScale");

  expireInput.disabled=noExpiry.checked;
  timeScale.disabled=noExpiry.checked;
}

