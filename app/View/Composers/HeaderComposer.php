<?php

namespace App\View\Composers;

use Illuminate\View\View;
use Illuminate\Support\Facades\Session;
use App\Models\User;

class HeaderComposer
{
    public function compose(View $view): void
    {
        $userId = Session::get('user');
        $user = $userId ? User::find($userId) : null;

        $view->with('user', $user);
    }
}
