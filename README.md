The software and code contained herein has absolutely no guarantee written or implied.
USE AT YOUR OWN RISK !!!

SMAUG Thunderbird Plugin
==========

The software in this repository has been constructed to serve as a proof of concept for 
S/MIME using DANE for message encryption and authentication.  This Add-on was forked from
the very impressive, and full-featured Enigmail Add-on (which is GPL licensed).

This prototype is tested on Red Hat Linux 6 and Mac OSX Version 10.9.

The origin of the work draws from the DANE working group in the IETF

  https://datatracker.ietf.org/wg/dane/charter/

Authored by Eric Osterweil eosterweil@verisign.com

Compiling
===========

```
git clone https://github.com/verisign/smaug-tbird-plugin.git
cd smaug-tbird-plugin
make
```

This will build the Add-on file ``smaug.xpi``


Thunderbird Extension Installation
===================================
Dependency: the Smaug reference library must be installed ( https://github.com/verisign/smaug )
Dependency: Thunderbird 31 (version tested)

* Install libsmaug
* Follow the above compiling instructions for this add-on
* Create (or reuse) an X.509 S/MIME certificate (a helper script for this is in the Smaug repo  
( https://github.com/verisign/smaug )
* Install this add-on in Thunderbird
* Configure the Smaug add-on with your personal S/MIME certificate

For example, install libsmaug (described in that project's README, https://github.com/verisign/smaug )

Next, compile this Add-on (described above)

Then, open Thunderbird, navigate to the "Tools -> Add-ons" menu.
<br/>
If you have not configured your mail account, in Thunderbird, do so now.
</br>
Next, click on the "Tools for all add-ons" button (top right corner of the tab, next to the search field).
<br/>
Choose "Install add-on from file..." option, and locate the newly compiled "smaug.xpi" file (in the "build/"
directory of the "smaug-tbird-plugin" repo.
<br/>
After installation (and relaunching Thunderbird), choose "Key Management" from the "Smaug" menu, and select your
S/MIME certificate.

Provisioning Your Zone With Your S/MIME Certificate(s)
=====================================================

Provision your zone is how Mail User Agents (MUAs), like Thunderbird, will be able to securely learn your signing
and encryption keys.  Online portals like the one listed here "" help offload the management details and access
complexities of provisioning and maintaining S/MIME certificates in DNS zones.  If, on the other hand, you prefer
to manage the material in your own zone, this is how to do it:

* Make sure your zone is DNSSEC enabled (from the root zone, to your TLD, and all the way to your zone).
* Use the tool ``smimeagen`` (installed with libsmaug, https://github.com/verisign/smaug ) to convert your S/MIME
certificate into SMIMEA records.
* Copy-and-paste the output of ``smimeagen`` into your DNS zone file, re-sign your zone, and reload it.
* Whenever you change your S/MIME certificate(s), be sure you update your DNS zone.


