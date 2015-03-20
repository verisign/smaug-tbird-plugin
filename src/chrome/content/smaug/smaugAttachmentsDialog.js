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
 * Copyright (C) 2003 Patrick Brunschwig. All Rights Reserved.
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

// Initialize smaugCommon
SmgInitCommon("smaugAttachmentsDialog");


var gArguments=arguments;
const SMG_INPUT=0;
const SMG_RESULT=1;

function smaugAttachDlgLoad() {
   DEBUG_LOG("smaugAttachmentsDialog.js: Load\n");

   var dialog=document.getElementById("attachmentsDialog");
   dialog.setAttribute("title", SmgGetString("smgPrompt"));

   var optionSel=document.getElementById("smaugAttachOptions");
   var descNotFound=document.getElementById("smgPgpMimeDetails");
   if (gArguments[SMG_INPUT].inlinePossible) {
     descNotFound.firstChild.data = SmgGetString("pgpMimeNote", SmgGetString("second"));
   }
   else {
     descNotFound.firstChild.data = SmgGetString("pgpMimeNote", SmgGetString("first"));
   }

   // set radiobutton labels according to whether we ask for sign and/or encrypt policy
   if (window.arguments[SMG_INPUT].reasonForCheck == "sign") {
       var rb = document.getElementById("smgEncryptAttachNone");
       rb.setAttribute("label", rb.getAttribute("data-signLabel"));
       rb = document.getElementById("smgEncryptAttachInline");
       rb.setAttribute("label", rb.getAttribute("data-signLabel"));
       rb = document.getElementById("smgEncryptAttachPgpMime");
       rb.setAttribute("label", rb.getAttribute("data-signLabel"));
       rb = document.getElementById("smgEncryptAttachDontEncryptMsg");
       rb.setAttribute("label", rb.getAttribute("data-signLabel"));
   }
   else if (window.arguments[SMG_INPUT].reasonForCheck == "encrypt") {
       var rb = document.getElementById("smgEncryptAttachNone");
       rb.setAttribute("label", rb.getAttribute("data-encryptLabel"));
       rb = document.getElementById("smgEncryptAttachInline");
       rb.setAttribute("label", rb.getAttribute("data-encryptLabel"));
       rb = document.getElementById("smgEncryptAttachPgpMime");
       rb.setAttribute("label", rb.getAttribute("data-encryptLabel"));
       rb = document.getElementById("smgEncryptAttachDontEncryptMsg");
       rb.setAttribute("label", rb.getAttribute("data-encryptLabel"));
   }
   else if (window.arguments[SMG_INPUT].reasonForCheck == "encryptAndSign") {
       var rb = document.getElementById("smgEncryptAttachNone");
       rb.setAttribute("label", rb.getAttribute("data-encryptAndSignLabel"));
       rb = document.getElementById("smgEncryptAttachInline");
       rb.setAttribute("label", rb.getAttribute("data-encryptAndSignLabel"));
       rb = document.getElementById("smgEncryptAttachPgpMime");
       rb.setAttribute("label", rb.getAttribute("data-encryptAndSignLabel"));
       rb = document.getElementById("smgEncryptAttachDontEncryptMsg");
       rb.setAttribute("label", rb.getAttribute("data-encryptAndSignLabel"));
   }

   var selected=SmgGetPref("encryptAttachments");
   if (! selected)
      selected=0;

   var node = optionSel.firstChild;
   var nodeCount=0;
   while (node) {
      if (!gArguments[SMG_INPUT].inlinePossible && nodeCount==1) {
      // disable inline PGP option
        node.disabled=true;
      }
      else if (!gArguments[SMG_INPUT].pgpMimePossible && nodeCount==2) {
      // disable PGP/MIME option
        node.disabled=true;
      }
      else if (nodeCount == selected) {
        optionSel.selectedItem=node;
        optionSel.value=selected;
      }

      ++nodeCount;
      node=node.nextSibling;
   }
   if (gArguments[SMG_INPUT].restrictedScenario) {
    document.getElementById("smaugAttachSkipDlg").disabled=true;
   }
}


function smaugAttachDlgAccept() {
  DEBUG_LOG("smaugAttachDlgAccept.js: Accept\n");

  var optionSel=document.getElementById("smaugAttachOptions");
  var skipDlg=document.getElementById("smaugAttachSkipDlg");

  if (skipDlg.checked) {
    SmgSetPref("encryptAttachmentsSkipDlg", 1);
  }
  if (optionSel) {
    if (optionSel.value != "") {
      gArguments[SMG_RESULT].selected = optionSel.value;
      if (gArguments[SMG_INPUT].restrictedScenario == false) {
        SmgSetPref("encryptAttachments", optionSel.value);
      }
      return true;
    }
    else {
       return false;
    }
  }
  return true;
}

