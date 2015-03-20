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

'use strict';

Components.utils.import("resource://smaug/smaugCommon.jsm");
Components.utils.import("resource://smaug/commonFuncs.jsm");
Components.utils.import("resource://smaug/mimeVerify.jsm");

if (! Smaug) var Smaug = {};


Smaug.hdrView = {

  statusBar: null,
  smaugBox: null,
  lastEncryptedMsgKey: null,


  hdrViewLoad: function ()
  {
    SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: this.hdrViewLoad\n");

    // Override SMIME ui
    var signedHdrElement = document.getElementById("signedHdrIcon");
    if (signedHdrElement) {
      signedHdrElement.setAttribute("onclick", "Smaug.msg.viewSecurityInfo(event, true);");
    }

    var encryptedHdrElement = document.getElementById("encryptedHdrIcon");
    if (encryptedHdrElement) {
      encryptedHdrElement.setAttribute("onclick", "Smaug.msg.viewSecurityInfo(event, true);");
    }

    this.statusBar = document.getElementById("smaug-status-bar");
    this.smaugBox = document.getElementById("smaugBox");

    var addrPopup = document.getElementById("emailAddressPopup");
    if (addrPopup) {
      var attr = addrPopup.getAttribute("onpopupshowing");
      attr = "SmaugFuncs.collapseAdvanced(this, 'hidden'); "+attr;
      addrPopup.setAttribute("onpopupshowing", attr);
    }
  },


  statusBarHide: function ()
  {
    try {
      this.statusBar.removeAttribute("signed");
      this.statusBar.removeAttribute("encrypted");
      this.smaugBox.setAttribute("collapsed", "true");
      Smaug.msg.setAttachmentReveal(null);
      if (Smaug.msg.securityInfo) {
        Smaug.msg.securityInfo.statusFlags = 0;
      }

    }
    catch (ex) {}
  },

  // Match the userId from gpg to the sender's from address
  matchUidToSender: function (userId)
  {
    var fromAddr = gFolderDisplay.selectedMessage.author;
    try {
      fromAddr=SmaugFuncs.stripEmail(fromAddr);
    }
    catch(ex) {}

    var userIdList=userId.split(/\n/);
    try {
      for (var i=0; i<userIdList.length; i++) {
        if (fromAddr.toLowerCase() == SmaugFuncs.stripEmail(userIdList[i]).toLowerCase()) {
          userId = userIdList[i];
          break;
        }
      }
      if (i>=userIdList.length) userId=userIdList[0];
    }
    catch (ex) {
      userId=userIdList[0];
    }
    return userId;
  },


  updateHdrIcons: function (exitCode, statusFlags, keyId, userId, sigDetails, errorMsg, blockSeparation, xtraStatus)
  {
    SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: this.updateHdrIcons: exitCode="+exitCode+", statusFlags="+statusFlags+", keyId="+keyId+", userId="+userId+", "+errorMsg+"\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    this.statusBar = document.getElementById("smaug-status-bar");
    this.smaugBox = document.getElementById("smaugBox");


    if (gFolderDisplay.selectedMessageUris.length > 0) {
      this.lastEncryptedMsgKey = gFolderDisplay.selectedMessageUris[0];
    }
    var bodyElement = document.getElementById("messagepanebox");

    if (!errorMsg) errorMsg="";

    var replaceUid=null;
    if (userId && (userId.indexOf("\n")>=0)) {
      replaceUid = this.matchUidToSender(userId);
    }
    else {
      replaceUid = userId;
    }

    if (Smaug.msg.savedHeaders && (Smaug.msg.savedHeaders["x-pgp-encoding-format"].search(/partitioned/i)==0)) {
      if (currentAttachments && currentAttachments.length) {
        Smaug.msg.setAttachmentReveal(currentAttachments);
      }
    }

    if (userId && replaceUid) {
      // no SmgConvertGpgToUnicode() here; strings are already UTF-8
      replaceUid = replaceUid.replace(/\\[xe]3a/gi, ":");
      errorMsg = errorMsg.replace(userId, replaceUid);
    }

    var errorLines="";
    var fullStatusInfo="";

    if (exitCode == SmaugCommon.POSSIBLE_PGPMIME) {
      exitCode = 0;
    }
    else {
      if (errorMsg) {
      // no SmgConvertGpgToUnicode() here; strings are already UTF-8
        errorLines = errorMsg.split(/\r?\n/);
        fullStatusInfo=errorMsg;
      }
    }


    if (errorLines && (errorLines.length > 22) ) {
      // Retain only first twenty lines and last two lines of error message
      var lastLines = errorLines[errorLines.length-2] + "\n" +
                      errorLines[errorLines.length-1] + "\n";

      while (errorLines.length > 20)
        errorLines.pop();

      errorMsg = errorLines.join("\n") + "\n...\n" + lastLines;
    }

    var statusInfo = "";
    var statusLine = "";
    var statusArr = [];

    if (statusFlags & nsIEnigmail.NODATA) {
      if (statusFlags & nsIEnigmail.PGP_MIME_SIGNED)
        statusFlags |= nsIEnigmail.UNVERIFIED_SIGNATURE;

      if (statusFlags & nsIEnigmail.PGP_MIME_ENCRYPTED)
        statusFlags |= nsIEnigmail.DECRYPTION_INCOMPLETE;
    }

    if (! SmaugCommon.getPref("displayPartiallySigned")) {
      if ((statusFlags & (nsIEnigmail.PARTIALLY_PGP))
          && (statusFlags & (nsIEnigmail.BAD_SIGNATURE))) {
        statusFlags &= ~(nsIEnigmail.BAD_SIGNATURE | nsIEnigmail.PARTIALLY_PGP);
        if (statusFlags == 0) {
          errorMsg="";
          fullStatusInfo="";
        }
      }
    }

    var msgSigned = (statusFlags & (nsIEnigmail.BAD_SIGNATURE |
                                    nsIEnigmail.GOOD_SIGNATURE |
                                    nsIEnigmail.EXPIRED_KEY_SIGNATURE |
                                    nsIEnigmail.EXPIRED_SIGNATURE |
                                    nsIEnigmail.UNVERIFIED_SIGNATURE |
                                    nsIEnigmail.REVOKED_KEY |
                                    nsIEnigmail.EXPIRED_KEY_SIGNATURE |
                                    nsIEnigmail.EXPIRED_SIGNATURE));
    var msgEncrypted = (statusFlags & (nsIEnigmail.DECRYPTION_OKAY |
                                       nsIEnigmail.DECRYPTION_INCOMPLETE |
                                       nsIEnigmail.DECRYPTION_FAILED));

    if (msgSigned && (statusFlags & nsIEnigmail.IMPORTED_KEY)) {
      statusFlags &= (~nsIEnigmail.IMPORTED_KEY);
    }

    if (((!(statusFlags & (nsIEnigmail.DECRYPTION_INCOMPLETE |
                           nsIEnigmail.DECRYPTION_FAILED |
                           nsIEnigmail.UNVERIFIED_SIGNATURE |
                           nsIEnigmail.BAD_SIGNATURE)))
         ||
         (statusFlags & nsIEnigmail.DISPLAY_MESSAGE) &&
          !(statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE)) &&
            !(statusFlags & nsIEnigmail.IMPORTED_KEY)) {
      // normal exit / display message
      statusLine = errorMsg;
      statusInfo = statusLine;

      if (sigDetails) {
        var detailArr=sigDetails.split(/ /);

        let dateTime = SmaugCommon.getDateTime(detailArr[2], true, true);
        var txt = SmaugCommon.getString("keyAndSigDate", [ keyId.substr(-8, 8), dateTime ] );
        statusArr.push(txt);
        statusInfo += "\n" + txt;
        var fpr = "";
        if (detailArr.length >= 10) {
          fpr = SmaugFuncs.formatFpr(detailArr[9]);
        }
        else {
          SmaugFuncs.formatFpr(detailArr[0]);
        }
        if (fpr) {
          statusInfo += "\n"+SmaugCommon.getString("keyFpr", [ fpr ]);
        }
      }
      fullStatusInfo = statusInfo;

    }
    else {
      // no normal exit / don't display message
      // - process failed decryptions first because they imply bad signature handling
      if (statusFlags & nsIEnigmail.DECRYPTION_FAILED) {
        if (statusFlags & nsIEnigmail.NO_SECKEY) {
          statusInfo = SmaugCommon.getString("needKey");
        } else {
          statusInfo = SmaugCommon.getString("failedDecrypt");
        }
        statusLine = statusInfo + SmaugCommon.getString("clickKeyDetails");
      }
      else if (statusFlags & nsIEnigmail.BAD_PASSPHRASE) {
        statusInfo = SmaugCommon.getString("badPhrase");
        statusLine = statusInfo + SmaugCommon.getString("clickDecryptRetry");
      }
      else if (statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) {
        statusInfo = SmaugCommon.getString("unverifiedSig");
        statusLine = statusInfo + SmaugCommon.getString("clickQueryPenDetails");
      }
      else if (statusFlags & (nsIEnigmail.BAD_SIGNATURE |
                              nsIEnigmail.EXPIRED_SIGNATURE |
                              nsIEnigmail.EXPIRED_KEY_SIGNATURE)) {
        statusInfo = SmaugCommon.getString("failedSig");
        statusLine = statusInfo + SmaugCommon.getString("clickPenDetails");
      }
      else if (statusFlags & nsIEnigmail.DECRYPTION_INCOMPLETE) {
        statusInfo = SmaugCommon.getString("incompleteDecrypt");
        statusLine = statusInfo + SmaugCommon.getString("clickKey");
      }
      else if (statusFlags & nsIEnigmail.IMPORTED_KEY) {
        statusLine = "";
        statusInfo = "";
        SmaugCommon.alert(window, errorMsg);
      }
      else {
        statusInfo = SmaugCommon.getString("failedDecryptVerify");
        statusLine = statusInfo + SmaugCommon.getString("viewInfo");
      }
      // add key infos if available
      if (keyId) {
        var si = SmaugCommon.getString("unverifiedSig");  // "Unverified signature"
        if (statusInfo == "") {
          statusInfo += si;
          statusLine = si + SmaugCommon.getString("clickPen");
        }
        //if (statusFlags & nsIEnigmail.INLINE_KEY) {
        //  statusLine = statusInfo + SmaugCommon.getString("clickDecrypt");
        //} else {
        //  statusLine = statusInfo + SmaugCommon.getString("clickPen");
        //}
        statusInfo += "\n" + SmaugCommon.getString("keyNeeded", [ keyId ]);  // "public key ... needed"
      }
      statusInfo += "\n\n" + errorMsg;
    }

    if (statusFlags & nsIEnigmail.DECRYPTION_OKAY ||
        (this.statusBar.getAttribute("encrypted")=="ok")) {
      var statusMsg;
      if (xtraStatus && xtraStatus == "buggyMailFormat") {
        statusMsg = SmaugCommon.getString("decryptedMsgWithFormatError");
      }
      else {
        statusMsg = SmaugCommon.getString("decryptedMsg");
      }
      if (!statusInfo) {
        statusInfo = statusMsg;
      }
      else {
        statusInfo = statusMsg + "\n" + statusInfo;
      }
      if (!statusLine) {
        statusLine = statusInfo;
      }
      else {
        statusLine = statusMsg + "; " + statusLine;
      }
    }

    if (SmaugCommon.getPref("displayPartiallySigned")) {
      if (statusFlags & nsIEnigmail.PARTIALLY_PGP) {
        if (msgSigned && msgEncrypted) {
          if (statusLine == "") {
            statusLine = SmaugCommon.getString("msgPart", [ SmaugCommon.getString("msgSignedAndEnc") ]);
            statusLine += SmaugCommon.getString("clickPenKeyDetails");
          }
          statusInfo = SmaugCommon.getString("msgPart", [ SmaugCommon.getString("msgSigned") ])
                        + "\n" + statusInfo;
        }
        else if (msgEncrypted) {
          if (statusLine == "") {
            statusLine = SmaugCommon.getString("msgPart", [ SmaugCommon.getString("msgEncrypted") ]);
            statusLine += SmaugCommon.getString("clickQueryKeyDetails");
          }
          statusInfo = SmaugCommon.getString("msgPart", [ SmaugCommon.getString("msgSigned") ])
                        + "\n" + statusInfo;
        }
        else if (msgSigned) {
          if (statusLine == "") {
            statusLine = SmaugCommon.getString("msgPart", [ SmaugCommon.getString("msgSigned") ]);
            statusLine += SmaugCommon.getString("clickQueryPenDetails");
          }
          statusInfo = SmaugCommon.getString("msgPart", [ SmaugCommon.getString("msgSigned") ])
                        + "\n" + statusInfo;
        }
      }
    }

    Smaug.msg.securityInfo = { statusFlags: statusFlags,
                          keyId: keyId,
                          userId: userId,
                          statusLine: statusLine,
                          msgSigned: msgSigned,
                          statusArr: statusArr,
                          statusInfo: statusInfo,
                          fullStatusInfo: fullStatusInfo,
                          blockSeparation: blockSeparation };

    var statusText  = document.getElementById("smaugStatusText");
    var expStatusText  = document.getElementById("expandedSmaugStatusText");
    var icon = document.getElementById("smgToggleHeaderView2");

    if (statusArr.length>0) {
      expStatusText.value = statusArr[0];
      expStatusText.setAttribute("state", "true");
      icon.removeAttribute("collapsed");
    }
    else {
      expStatusText.value = "";
      expStatusText.setAttribute("state", "false");
      icon.setAttribute("collapsed", "true");
    }

    if (statusLine) {
      statusText.value = statusLine +" ";
      this.smaugBox.removeAttribute("collapsed");
      this.displayExtendedStatus(true);
    } else {
      statusText.value = "";
      this.smaugBox.setAttribute("collapsed", "true");
      this.displayExtendedStatus(false);
    }

    if (!gSMIMEContainer)
      return;

    // Update icons and header-box css-class
    try {
      gSMIMEContainer.collapsed = false;
      gSignedUINode.collapsed = false;
      gEncryptedUINode.collapsed = false;

      if ((statusFlags & nsIEnigmail.BAD_SIGNATURE) &&
          !(statusFlags & nsIEnigmail.GOOD_SIGNATURE)){
        // Display untrusted/bad signature icon
        gSignedUINode.setAttribute("signed", "notok");
        this.smaugBox.setAttribute("class", "expandedSmaugBox smaugHeaderBoxLabelSignatureNotOk");
        this.statusBar.setAttribute("signed", "notok");
      }
      else if ((statusFlags & nsIEnigmail.GOOD_SIGNATURE) &&
          (statusFlags & nsIEnigmail.TRUSTED_IDENTITY) &&
          !(statusFlags & (nsIEnigmail.REVOKED_KEY |
                         nsIEnigmail.EXPIRED_KEY_SIGNATURE |
                         nsIEnigmail.EXPIRED_SIGNATURE))) {
        // Display trusted good signature icon
        gSignedUINode.setAttribute("signed", "ok");
        this.smaugBox.setAttribute("class", "expandedSmaugBox smaugHeaderBoxLabelSignatureOk");
        this.statusBar.setAttribute("signed", "ok");
        bodyElement.setAttribute("smgSigned", "ok");
      }
      else if (statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) {
        // Display unverified signature icon
        gSignedUINode.setAttribute("signed", "unknown");
        this.smaugBox.setAttribute("class", "expandedSmaugBox smaugHeaderBoxLabelSignatureUnknown");
        this.statusBar.setAttribute("signed", "unknown");
      }
      else if (statusFlags & (nsIEnigmail.REVOKED_KEY |
                         nsIEnigmail.EXPIRED_KEY_SIGNATURE |
                         nsIEnigmail.EXPIRED_SIGNATURE |
                         nsIEnigmail.GOOD_SIGNATURE)) {
        // Display unverified signature icon
        gSignedUINode.setAttribute("signed", "unknown");
        this.smaugBox.setAttribute("class", "expandedSmaugBox smaugHeaderBoxLabelSignatureVerified");
        this.statusBar.setAttribute("signed", "unknown");
      }
      else if (statusFlags & nsIEnigmail.INLINE_KEY) {
        this.smaugBox.setAttribute("class", "expandedSmaugBox smaugHeaderBoxLabelSignatureUnknown");
      }
      else {
        this.smaugBox.setAttribute("class", "expandedSmaugBox smaugHeaderBoxLabelNoSignature");
      }

      if (statusFlags & nsIEnigmail.DECRYPTION_OKAY) {
        SmaugCommon.rememberEncryptedUri(this.lastEncryptedMsgKey);

        // Display encrypted icon
        gEncryptedUINode.setAttribute("encrypted", "ok");
        this.statusBar.setAttribute("encrypted", "ok");
      }
      else if (statusFlags &
        (nsIEnigmail.DECRYPTION_INCOMPLETE | nsIEnigmail.DECRYPTION_FAILED) ) {
        // Display un-encrypted icon
        gEncryptedUINode.setAttribute("encrypted", "notok");
        this.statusBar.setAttribute("encrypted", "notok");
        this.smaugBox.setAttribute("class", "expandedSmaugBox smaugHeaderBoxLabelSignatureNotOk");
      }

      // special handling after trying to fix buggy mail format (see buggyExchangeEmailContent in code)
      if (xtraStatus && xtraStatus == "buggyMailFormat") {
        this.smaugBox.setAttribute("class", "expandedSmaugBox smaugHeaderBoxLabelBuggyMailFormat");
      }

      this.updateMsgDb();


    } catch (ex) {}
  },

  dispSecurityContext: function ()
  {

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    if (Smaug.msg.securityInfo) {
      if (Smaug.msg.securityInfo.keyId &&
          (Smaug.msg.securityInfo.statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE) ) {
        document.getElementById("smaug_importKey").removeAttribute("hidden");
      }
      else {
        document.getElementById("smaug_importKey").setAttribute("hidden", "true");
      }

      if ( (Smaug.msg.securityInfo.statusFlags & nsIEnigmail.NODATA) &&
           (Smaug.msg.securityInfo.statusFlags &
             (nsIEnigmail.PGP_MIME_SIGNED | nsIEnigmail.PGP_MIME_ENCRYPTED)) ) {
        document.getElementById("smaug_reloadMessage").removeAttribute("hidden");
      }
      else {
        document.getElementById("smaug_reloadMessage").setAttribute("hidden", "true");
      }
    }

    var optList = ["pgpSecurityInfo", "copySecurityInfo"];
    for (var j=0; j<optList.length; j++) {
      var menuElement = document.getElementById("smaug_"+optList[j]);
      if (Smaug.msg.securityInfo) {
        menuElement.removeAttribute("disabled");
      }
      else {
        menuElement.setAttribute("disabled", "true");
      }
    }

    this.setSenderStatus("signSenderKey", "editSenderKeyTrust" , "showPhoto", "dispKeyDetails");
  },


  updateSendersKeyMenu: function ()
  {
    this.setSenderStatus("keyMgmtSignKey", "keyMgmtKeyTrust", "keyMgmtShowPhoto", "keyMgmtDispKeyDetails");
  },


  setSenderStatus: function (elemSign, elemTrust, elemPhoto, elemKeyProps)
  {
    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    var photo=false;
    var sign=false;
    var trust=false;
    if (Smaug.msg.securityInfo) {
      if (Smaug.msg.securityInfo.statusFlags & nsIEnigmail.PHOTO_AVAILABLE) {
        photo=true;
      }
      if (Smaug.msg.securityInfo.msgSigned ) {
        if (!(Smaug.msg.securityInfo.statusFlags &
             (nsIEnigmail.REVOKED_KEY | nsIEnigmail.EXPIRED_KEY_SIGNATURE | nsIEnigmail.UNVERIFIED_SIGNATURE))) {
          sign=true;
        }
        if (!(Smaug.msg.securityInfo.statusFlags & nsIEnigmail.UNVERIFIED_SIGNATURE)) {
          trust=true;
        }
      }
    }

    if (elemTrust)
      document.getElementById("smaug_"+elemTrust).setAttribute("disabled", !trust);
    if (elemSign)
      document.getElementById("smaug_"+elemSign).setAttribute("disabled", !sign);
    if (elemPhoto)
      document.getElementById("smaug_"+elemPhoto).setAttribute("disabled", !photo);
    if (elemKeyProps)
      document.getElementById("smaug_"+elemKeyProps).setAttribute("disabled", !sign);

  },

  editKeyExpiry: function ()
  {
    SmaugFuncs.editKeyExpiry(window, [Smaug.msg.securityInfo.userId], [Smaug.msg.securityInfo.keyId]);
    gDBView.reloadMessageWithAllParts();
  },

  editKeyTrust: function ()
  {
    SmaugFuncs.editKeyTrust(window, [Smaug.msg.securityInfo.userId], [Smaug.msg.securityInfo.keyId]);
    gDBView.reloadMessageWithAllParts();
  },

  signKey: function ()
  {
    SmaugFuncs.signKey(window, Smaug.msg.securityInfo.userId, Smaug.msg.securityInfo.keyId, null);
    gDBView.reloadMessageWithAllParts();
  },


  msgHdrViewLoad: function (event)
  {
    SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: this.msgHdrViewLoad\n");

    var listener = {
      smaugBox: document.getElementById("smaugBox"),
      onStartHeaders: function _listener_onStartHeaders ()
      {
        SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: _listener_onStartHeaders\n");

        try {

          Smaug.hdrView.statusBarHide();

          SmaugVerify.setMsgWindow(msgWindow, Smaug.msg.getCurrentMsgUriSpec());

          var statusText = document.getElementById("smaugStatusText");
          if (statusText) statusText.value="";

          this.smaugBox.setAttribute("class", "expandedSmaugBox smaugHeaderBoxLabelSignatureOk");

          var msgFrame = SmaugCommon.getFrame(window, "messagepane");

          if (msgFrame) {
            SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: msgFrame="+msgFrame+"\n");

            msgFrame.addEventListener("unload", Smaug.hdrView.messageUnload.bind(Smaug.hdrView), true);
            msgFrame.addEventListener("load", Smaug.msg.messageAutoDecrypt.bind(Smaug.msg), false);
          }

          Smaug.hdrView.forgetEncryptedMsgKey();

          if (messageHeaderSink) {
            try {
              messageHeaderSink.smaugPrepSecurityInfo();
            }
            catch (ex) {}
          }
        }
        catch (ex) {}
      },

      onEndHeaders: function _listener_onEndHeaders ()
      {
        SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: _listener_onEndHeaders\n");
        try {
          Smaug.hdrView.statusBarHide();
          var statusText = document.getElementById("smaugStatusText");

          this.smaugBox.setAttribute("class", "expandedSmaugBox smaugHeaderBoxLabelSignatureOk");
        }
        catch (ex) {}
      },

      beforeStartHeaders: function _listener_beforeStartHeaders ()
      {
        return true;
      }
    };

    gMessageListeners.push(listener);
  },

  messageUnload: function ()
  {
    SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: this.messageUnload\n");
  },

  hdrViewUnload: function ()
  {
    SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: this.hdrViewUnLoad\n");
    this.forgetEncryptedMsgKey();
  },

  copyStatusInfo: function ()
  {
    if (Smaug.msg.securityInfo) {
      var clipHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].createInstance(Components.interfaces.nsIClipboardHelper);
      clipHelper.copyString(Smaug.msg.securityInfo.fullStatusInfo);
    }

  },

  showPhoto: function ()
  {
    if (! Smaug.msg.securityInfo) return;

    SmaugFuncs.showPhoto(window, Smaug.msg.securityInfo.keyId, Smaug.msg.securityInfo.userId);
  },


  dispKeyDetails: function ()
  {
    if (! Smaug.msg.securityInfo) return;

    SmaugFuncs.openKeyDetails(window, Smaug.msg.securityInfo.keyId, false);
  },

  createRuleFromAddress: function (emailAddressNode)
  {
    if (emailAddressNode)
    {
      if (typeof(findEmailNodeFromPopupNode)=="function") {
        emailAddressNode = findEmailNodeFromPopupNode(emailAddressNode, 'emailAddressPopup');
      }
      SmaugFuncs.createNewRule(window, emailAddressNode.getAttribute("emailAddress"));
    }
  },

  forgetEncryptedMsgKey: function ()
  {
    if (Smaug.hdrView.lastEncryptedMsgKey)
    {
      SmaugCommon.forgetEncryptedUri(Smaug.hdrView.lastEncryptedMsgKey);
      Smaug.hdrView.lastEncryptedMsgKey = null;
    }
  },

  msgHdrViewHide: function ()
  {
    SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: this.msgHdrViewHide\n");
    this.smaugBox.setAttribute("collapsed", true);

    Smaug.msg.securityInfo = { statusFlags: 0,
                        keyId: "",
                        userId: "",
                        statusLine: "",
                        statusInfo: "",
                        fullStatusInfo: "" };

  },

  msgHdrViewUnhide: function (event)
  {
    SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: this.msgHdrViewUnhide:\n");

    if (Smaug.msg.securityInfo.statusFlags != 0) {
      this.smaugBox.removeAttribute("collapsed");
    }
  },

  displayExtendedStatus: function (displayOn)
  {
    var expStatusText  = document.getElementById("expandedSmaugStatusText");
    if (displayOn && expStatusText.getAttribute("state") == "true") {
      if (expStatusText.getAttribute("display") == "true") {
        expStatusText.removeAttribute("collapsed");
      }
      else {
        expStatusText.setAttribute("collapsed", "true");
      }
    }
    else {
      expStatusText.setAttribute("collapsed", "true");
    }
  },

  toggleHeaderView: function ()
  {
    var viewToggle = document.getElementById("smgToggleHeaderView2");
    var expandedText = document.getElementById("expandedSmaugStatusText");
    var state = viewToggle.getAttribute("state");

    if (state=="true") {
      viewToggle.setAttribute("state", "false");
      viewToggle.setAttribute("class", "smaugExpandViewButton");
      expandedText.setAttribute("display", "false");
      this.displayExtendedStatus(false);
    }
    else {
      viewToggle.setAttribute("state", "true");
      viewToggle.setAttribute("class", "smaugCollapseViewButton");
      expandedText.setAttribute("display", "true");
      this.displayExtendedStatus(true);
    }
  },

  smgOnShowAttachmentContextMenu: function ()
  {
    SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: this.smgOnShowAttachmentContextMenu\n");
    // first, call the original function ...

    try {
      // Thunderbird
      onShowAttachmentItemContextMenu();
    }
    catch (ex) {
      // SeaMonkey
      onShowAttachmentContextMenu();
    }

    // then, do our own additional stuff ...

    // Thunderbird
    var contextMenu = document.getElementById('attachmentItemContext');
    var selectedAttachments = contextMenu.attachments;

    if (! contextMenu) {
      // SeaMonkey
      contextMenu = document.getElementById('attachmentListContext');
      selectedAttachments = attachmentList.selectedItems;
    }

    var decryptOpenMenu = document.getElementById('smaug_ctxDecryptOpen');
    var decryptSaveMenu = document.getElementById('smaug_ctxDecryptSave');
    var importMenu = document.getElementById('smaug_ctxImportKey');
    var verifyMenu = document.getElementById('smaug_ctxVerifyAtt');

    if (selectedAttachments.length > 0) {
      if (selectedAttachments[0].contentType.search(/^application\/pgp-keys/i) == 0) {
        importMenu.removeAttribute('disabled');
        decryptOpenMenu.setAttribute('disabled', true);
        decryptSaveMenu.setAttribute('disabled', true);
        verifyMenu.setAttribute('disabled', true);
      }
      else if (Smaug.msg.checkSignedAttachment(selectedAttachments[0], null)) {
        importMenu.setAttribute('disabled', true);
        decryptOpenMenu.setAttribute('disabled', true);
        decryptSaveMenu.setAttribute('disabled', true);
        verifyMenu.removeAttribute('disabled');
      }
      else if (Smaug.msg.checkEncryptedAttach(selectedAttachments[0])) {
        importMenu.setAttribute('disabled', true);
        decryptOpenMenu.removeAttribute('disabled');
        decryptSaveMenu.removeAttribute('disabled');
        verifyMenu.setAttribute('disabled', true);
        if (typeof(selectedAttachments[0].displayName) == "undefined") {
          if (! selectedAttachments[0].name) {
            selectedAttachments[0].name="message.pgp";
          }
        }
        else
          if (! selectedAttachments[0].displayName) {
            selectedAttachments[0].displayName="message.pgp";
          }
      }
      else {
        importMenu.setAttribute('disabled', true);
        decryptOpenMenu.setAttribute('disabled', true);
        decryptSaveMenu.setAttribute('disabled', true);
        verifyMenu.setAttribute('disabled', true);
      }
    }
    else {
      openMenu.setAttribute('disabled', true);
      saveMenu.setAttribute('disabled', true);
      decryptOpenMenu.setAttribute('disabled', true);
      decryptSaveMenu.setAttribute('disabled', true);
      importMenu.setAttribute('disabled', true);
      verifyMenu.setAttribute('disabled', true);
    }
  },

  updateMsgDb: function ()
  {
    SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: this.updateMsgDb\n");
    var msg = gFolderDisplay.selectedMessage;
    var msgHdr = msg.folder.GetMessageHeader(msg.messageKey);
    if (this.statusBar.getAttribute("encrypted") == "ok")
      Smaug.msg.securityInfo.statusFlags |= Components.interfaces.nsIEnigmail.DECRYPTION_OKAY;
    msgHdr.setUint32Property("smaug", Smaug.msg.securityInfo.statusFlags);
  },

  smgCanDetachAttachments: function ()
  {
    SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: this.smgCanDetachAttachments\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    var canDetach = true;
    if (Smaug.msg.securityInfo && (typeof(Smaug.msg.securityInfo.statusFlags) != "undefined")) {
      canDetach = ((Smaug.msg.securityInfo.statusFlags &
                   (nsIEnigmail.PGP_MIME_SIGNED | nsIEnigmail.PGP_MIME_ENCRYPTED)) ? false : true);
    }
    return canDetach;
  },

  fillAttachmentListPopup: function (item)
  {
    SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: Smaug.hdrView.fillAttachmentListPopup\n");
    FillAttachmentListPopup(item);

    if (! this.smgCanDetachAttachments()) {
      for (var i=0; i< item.childNodes.length; i++) {
        if (item.childNodes[i].className == "menu-iconic") {
          var mnu = item.childNodes[i].firstChild.firstChild;
          while (mnu) {
            if (mnu.getAttribute("oncommand").search(/(detachAttachment|deleteAttachment)/) >=0) {
              mnu.setAttribute("disabled" , true);
            }
            mnu = mnu.nextSibling;
          }
        }
      }
    }
  }

};

window.addEventListener("load", Smaug.hdrView.hdrViewLoad.bind(Smaug.hdrView), false);
addEventListener('messagepane-loaded', Smaug.hdrView.msgHdrViewLoad.bind(Smaug.hdrView), true);
addEventListener('messagepane-unloaded', Smaug.hdrView.hdrViewUnload.bind(Smaug.hdrView), true);
addEventListener('messagepane-hide', Smaug.hdrView.msgHdrViewHide.bind(Smaug.hdrView), true);
addEventListener('messagepane-unhide', Smaug.hdrView.msgHdrViewUnhide.bind(Smaug.hdrView), true);

////////////////////////////////////////////////////////////////////////////////
// THE FOLLOWING OVERRIDES CODE IN msgHdrViewOverlay.js
////////////////////////////////////////////////////////////////////////////////

// there is unfortunately no other way to add Smaug to the validator than this

function CanDetachAttachments()
{
  var canDetach = !gFolderDisplay.selectedMessageIsNews &&
                  (!gFolderDisplay.selectedMessageIsImap || MailOfflineMgr.isOnline());

  if (canDetach && ("content-type" in currentHeaderData))
  {
    var contentType = currentHeaderData["content-type"].headerValue;

    canDetach = !ContentTypeIsSMIME(currentHeaderData["content-type"].headerValue);
  }
  return canDetach && Smaug.hdrView.smgCanDetachAttachments();
}

// Distinction between createNewAttachmentInfo and AttachmentInfo
// due to renamed function in MsgHdrView.js in TB trunk code.
// Can be removed in later versions of Smaug.

try
{
     createNewAttachmentInfo.prototype.origOpenAttachment = createNewAttachmentInfo.prototype.openAttachment;
     createNewAttachmentInfo.prototype.openAttachment = function ()
     {
       this.origOpenAttachment();
     };
}
catch (ex)
{
    AttachmentInfo.prototype.origOpenAttachment = AttachmentInfo.prototype.openAttachment;
    AttachmentInfo.prototype.openAttachment = function ()
    {
      this.origOpenAttachment();
    };
}


////////////////////////////////////////////////////////////////////////////////
// THE FOLLOWING EXTENDS CODE IN msgHdrViewOverlay.js
////////////////////////////////////////////////////////////////////////////////

if (messageHeaderSink) {
  messageHeaderSink.smaugPrepSecurityInfo = function ()
  {
    SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: smaugPrepSecurityInfo\n");


    /// BEGIN SmgMimeHeaderSink definition
    function SmgMimeHeaderSink(innerSMIMEHeaderSink) {
        SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: SmgMimeHeaderSink.innerSMIMEHeaderSink="+innerSMIMEHeaderSink+"\n");
      this._smimeHeaderSink = innerSMIMEHeaderSink;
    }

    SmgMimeHeaderSink.prototype =
    {
      _smimeHeaderSink: null,

      QueryInterface : function(iid)
      {
        //SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: SmgMimeHeaderSink.QI: "+iid+"\n");
        if (iid.equals(Components.interfaces.nsIMsgSMIMEHeaderSink) &&
            this._smimeHeaderSink)
          return this;

        if (iid.equals(Components.interfaces.nsISmgMimeHeaderSink) ||
            iid.equals(Components.interfaces.nsISupports) )
          return this;

        throw Components.results.NS_NOINTERFACE;
      },

      updateSecurityStatus: function (uriSpec, exitCode, statusFlags, keyId, userId, sigDetails, errorMsg, blockSeparation, uri)
      {
        // uri is not used here; added for compatibility to other addons
        SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: SmgMimeHeaderSink.updateSecurityStatus: uriSpec="+uriSpec+"\n");

        var msgUriSpec = Smaug.msg.getCurrentMsgUriSpec();

        SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: SmgMimeHeaderSink.updateSecurityStatus: msgUriSpec="+msgUriSpec+"\n");

        if (!uriSpec || (uriSpec == msgUriSpec)) {
          Smaug.hdrView.updateHdrIcons(exitCode, statusFlags, keyId, userId, sigDetails, errorMsg, blockSeparation);
        }

        return;
      },

      maxWantedNesting: function ()
      {
        SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: SmgMimeHeaderSink.maxWantedNesting:\n");
        return this._smimeHeaderSink.maxWantedNesting();
      },

      signedStatus: function (aNestingLevel, aSignatureStatus, aSignerCert)
      {
        SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: SmgMimeHeaderSink.signedStatus:\n");
        return this._smimeHeaderSink.signedStatus(aNestingLevel, aSignatureStatus, aSignerCert);
      },

      encryptionStatus: function (aNestingLevel, aEncryptionStatus, aRecipientCert)
      {
        SmaugCommon.DEBUG_LOG("smaugMsgHdrViewOverlay.js: SmgMimeHeaderSink.encryptionStatus:\n");
        return this._smimeHeaderSink.encryptionStatus(aNestingLevel, aEncryptionStatus, aRecipientCert);
      }

    };
    /// END SmgMimeHeaderSink definition

    var innerSMIMEHeaderSink = null;
    var smaugHeaderSink = null;

    try {
      innerSMIMEHeaderSink = this.securityInfo.QueryInterface(Components.interfaces.nsIMsgSMIMEHeaderSink);

      try {
        smaugHeaderSink = innerSMIMEHeaderSink.QueryInterface(Components.interfaces.nsISmgMimeHeaderSink);
      } catch (ex) {}
    } catch (ex) {}

    if (!smaugHeaderSink) {
      this.securityInfo = new SmgMimeHeaderSink(innerSMIMEHeaderSink);
    }
  };
}
