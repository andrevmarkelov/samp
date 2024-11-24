<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

class NewsController extends Controller
{
    /**
     * Список всех новостей
     *
     * @return View
     */
    public function index(): View
    {
        $news = [];

        return view('admin.news.index', [
            'news' => $news
        ]);
    }

    /**
     * Страница создание новости
     *
     * @return View
     */
    public function createForm(): View
    {
        return view('admin.news.create');
    }
}
