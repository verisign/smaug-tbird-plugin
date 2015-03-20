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
Components.utils.import("resource://smaug/commonFuncs.jsm");

if (! Smaug) var Smaug = {};

Smaug.edit = {
  account: null,
  identity: null,
  enablePgp: null,
  pgpKeyMode: null,
  pgpKeyId: null,
  cryptoChoicesEnabled: null,
  signingPolicy: null,     // account specific: by default sign
  encryptionPolicy: null,  // account specific: by default encrypt
  pgpMimeMode: null,       // account specific: by default pgp/mime
  pgpSignPlainPolicy: null,
  pgpSignEncPolicy: null,
  autoEncryptDrafts: null,
  advancedSettings: null,

  onInit: function ()
  {
    // initialize all of our elements based on the current identity values....
    SmaugFuncs.collapseAdvanced(document.getElementById("smaug_PrefsBox"), "hidden");

    this.enablePgp          = document.getElementById("smaug_enablePgp");
    this.pgpKeyMode         = document.getElementById("smaug_pgpKeyMode");
    this.pgpKeyId           = document.getElementById("smaug_identity.pgpkeyId");
    this.signingPolicy      = document.getElementById("smaug_sign_ifPossible");
    this.encryptionPolicy   = document.getElementById("smaug_encrypt_ifPossible");
    this.pgpMimeMode        = document.getElementById("smaug_pgpMimeMode");
    this.pgpSignEncPolicy   = document.getElementById("smaug_sign_encrypted");
    this.pgpSignPlainPolicy = document.getElementById("smaug_sign_notEncrypted");
    this.autoEncryptDrafts  = document.getElementById("smaug_autoEncryptDrafts");

    if (this.identity) {
      this.enablePgp.checked  = this.identity.getBoolAttribute("enablePgp");
      this.cryptoChoicesEnabled = this.enablePgp.checked;

      var selectedItemId = null;
      var keyPolicy = this.identity.getIntAttribute("pgpKeyMode");
      switch (keyPolicy)
      {
        case 1:
          selectedItemId = 'smaug_keymode_usePgpkeyId';
          break;
        default:
          selectedItemId = 'smaug_keymode_useFromAddress';
          break;
      }
      this.pgpKeyMode.selectedItem = document.getElementById(selectedItemId);

      this.pgpKeyId.value = this.identity.getCharAttribute("pgpkeyId");
      SmaugFuncs.getSignMsg(this.identity);
      this.signingPolicy.checked = (this.identity.getIntAttribute("defaultSigningPolicy")>0);
      this.encryptionPolicy.checked = (this.identity.getIntAttribute("defaultEncryptionPolicy")>0);
      this.pgpMimeMode.checked = this.identity.getBoolAttribute("pgpMimeMode");
      this.pgpSignEncPolicy.checked = this.identity.getBoolAttribute("pgpSignEncrypted");
      this.pgpSignPlainPolicy.checked = this.identity.getBoolAttribute("pgpSignPlain");
      this.autoEncryptDrafts.checked = this.identity.getBoolAttribute("autoEncryptDrafts");
      this.advancedSettings = {
        openPgpHeaderMode: this.identity.getIntAttribute("openPgpHeaderMode"),
        openPgpUrlName: this.identity.getCharAttribute("openPgpUrlName"),
        attachPgpKey: this.identity.getBoolAttribute("attachPgpKey")
      };

    }
    else {
      this.enablePgp.checked=false;
      this.cryptoChoicesEnabled=false;
      this.advancedSettings = {
        openPgpHeaderMode: 0,
        openPgpUrlName: "",
        attachPgpKey: false
      };
    }

    // Disable all locked elements on the panel
    //onLockPreference();
    this.enableAllPrefs();
  },

  onLoadEditor: function ()
  {
    if (typeof(gAccount) == "object") {
      this.account  = gAccount;
      this.identity = gIdentity;
    }
    else {
      this.identity = window.arguments[0].identity;
      this.account = window.arguments[0].account;
    }

    if (this.identity) {
      var idLabel = SmaugCommon.getString("identityName", [ this.identity.identityName ]);
      document.getElementById("smaug_identityName").value = idLabel;
    }

    var dlg = document.getElementsByTagName("dialog")[0];
    dlg.setAttribute("ondialogaccept", "return Smaug.edit.onAcceptEditor();");

    this.onInit();
  },

  onAcceptEditor: function ()
  {
    try {
      if (onOk()==false) {
        return false;
      }
    }
    catch (ex) {}
    this.onSave();
    if (typeof(smimeOnAcceptEditor) == "function") {
      return smimeOnAcceptEditor();
    }
    else
      return true;
  },

  onSave: function ()
  {
    if (! this.identity) {
      this.identity = gIdentity;
    }
    this.identity.setBoolAttribute("enablePgp", this.enablePgp.checked);

    if (this.enablePgp.checked) {
      // PGP is enabled
      this.identity.setIntAttribute("pgpKeyMode", this.pgpKeyMode.selectedItem.value);
      this.identity.setCharAttribute("pgpkeyId", this.pgpKeyId.value);
      this.identity.setIntAttribute("defaultSigningPolicy", (this.signingPolicy.checked ? 1 : 0));
      this.identity.setIntAttribute("defaultEncryptionPolicy", (this.encryptionPolicy.checked ? 1 : 0));
      this.identity.setBoolAttribute("pgpMimeMode", this.pgpMimeMode.checked);
      this.identity.setBoolAttribute("pgpSignEncrypted", this.pgpSignEncPolicy.checked);
      this.identity.setBoolAttribute("pgpSignPlain", this.pgpSignPlainPolicy.checked);
      this.identity.setBoolAttribute("autoEncryptDrafts", this.autoEncryptDrafts.checked);
      this.identity.setIntAttribute("openPgpHeaderMode", this.advancedSettings.openPgpHeaderMode);
      this.identity.setCharAttribute("openPgpUrlName", this.advancedSettings.openPgpUrlName);
      this.identity.setBoolAttribute("attachPgpKey", this.advancedSettings.attachPgpKey);

    }
  },

  toggleEnable: function ()
  {
    this.cryptoChoicesEnabled = (! this.cryptoChoicesEnabled);
    this.enableAllPrefs();
  },

  enableAllPrefs: function ()
  {
    var elem = document.getElementById("smaug_bcEnablePgp");
    if (this.cryptoChoicesEnabled) {
      if (elem) elem.removeAttribute("disabled");
    }
    else {
      if (elem) elem.setAttribute("disabled", "true");
    }

    this.enableKeySel(this.cryptoChoicesEnabled && (this.pgpKeyMode.value == 1));

  },

  enableKeySel: function (enable)
  {
    if (enable) {
      document.getElementById("smaug_bcUseKeyId").removeAttribute("disabled");
    }
    else {
      document.getElementById("smaug_bcUseKeyId").setAttribute("disabled", "true");
    }
  },

  selectKeyId: function ()
  {
    var resultObj = new Object();
    var inputObj = new Object();
    inputObj.dialogHeader = SmaugCommon.getString("encryptKeyHeader");
    inputObj.options = "single,hidexpired,private,nosending";
    var button = document.getElementById("smaug_selectPgpKey");
    var label = button.getAttribute("label");
    inputObj.options += ",sendlabel=" + label;
    inputObj.options += ",";

    window.openDialog("chrome://smaug/content/smaugUserSelection.xul","", "dialog,modal,centerscreen", inputObj, resultObj);
    try {
      if (resultObj.cancelled) return;
      var selKey = resultObj.userList[0];
      selKey = "0x"+selKey.substring(10,18);
      this.pgpKeyId.value = selKey;
    } catch (ex) {
      // cancel pressed -> don't send mail
      return;
    }
  },

  advancedIdentitySettings: function ()
  {
    var inputObj = {
      identitySettings: this.advancedSettings,
      pgpKeyMode: this.pgpKeyMode.selectedItem.value
    };
    window.openDialog("chrome://smaug/content/smaugAdvancedIdentityDlg.xul","", "dialog,modal,centerscreen", inputObj);
  }
};
