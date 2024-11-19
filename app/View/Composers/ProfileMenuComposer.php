<?php

namespace App\View\Composers;

use Illuminate\View\View;
use App\Models\User;

class ProfileMenuComposer
{
    /**
     * Передаем данные пользователя в меню профиля
     *
     * @param View $view
     * @return void
     */
    public function compose(View $view): void
    {
        $userId = session('user');
        $user = User::find($userId);

        $view->with('username', $user->username);
        $view->with('p_skin', $user->p_skin);
    }
}
