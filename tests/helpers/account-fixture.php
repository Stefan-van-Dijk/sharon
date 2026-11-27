<?php
declare(strict_types=1);

// Existing Shop tests use a real verified account and keep their original device identity.
function verified_account_session(LogNetwork $service, array $person): string {
    $email=strtolower($person['personId']).'@example.test';
    $password='fixture-password-123';
    $service->handle('account-register',['email'=>$email,'password'=>$password],null);
    $code=null;
    $service->deliverAccountMail(function(array $item)use(&$code,$email):bool {
        if($item['email']===$email)$code=$item['code'];
        return true;
    });
    if($code===null)throw new RuntimeException('Verification mail missing');
    $service->handle('account-verify',['email'=>$email,'password'=>$password,'code'=>$code],null);
    return $service->handle('account-login',[...$person,'email'=>$email,'password'=>$password],null)['sessionToken'];
}
