<?php

namespace App\View\Composers;

use Illuminate\View\View;

class AdminMenuComposer
{
    /**
     * Передаем данные админа в меню админки
     *
     * @param View $view
     * @return void
     */
    public function compose(View $view): void
    {
        $admin = auth('admin')->user();
        $view->with('admin', $admin);
    }
}
