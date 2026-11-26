<?php
// Copy to payment.local.php only after the receiving account has been verified by its owner.
// Keep this file outside backend/public. Never put API credentials or banking passwords here.
return [
 'enabled'=>false,
 'sandbox'=>false, // only accepted on isolated *_test_* databases; no bank account required
 'verified'=>false,
 'bank_name'=>'',
 'bank_bin'=>'', // six digits; verify against the receiving bank
 'account_number'=>'',
 'account_name'=>'',
 'simulation'=>false,
];
