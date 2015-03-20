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

smaug.xpi

This is the Thunderbird extension.


Thunderbird Extension Installation
===================================
Dependency: the Smaug reference library must be installed ( https://github.com/verisign/smaug )
Dependency: Thunderbird 31 (version tested)

* Install libsmaug
* Checkout the full smaug Thunderbird repository
* Compile
* Create (or reuse) an X.509 S/MIME certificate
* Install in Thunderbird
* Configure the Smaug plugin with your personal S/MIME certificate

For example, after installing libsmaug (described in the project's README):

```
git clone "this repository"
cd smaug-tbird-plugin
make
```

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
