<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\View\View;

class PageController extends Controller
{
    /**
     * Страница "О нас"
     *
     * @return View
     */
    public function about(): View
    {
        return view('company.about');
    }

    /**
     * Страница "Пользовательское соглашение"
     *
     * @return View
     */
    public function userAgreement(): View
    {
        return view('company.user-agreement');
    }

    /**
     * Страница "Политика конфиденциальности"
     *
     * @return View
     */
    public function privacyPolicy(): View
    {
        return view('company.privacy-policy');
    }
}
