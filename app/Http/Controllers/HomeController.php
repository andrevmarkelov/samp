<?php

namespace App\Http\Controllers;

use App\Models\News;
use Illuminate\Contracts\View\View;

class HomeController extends Controller
{
    /**
     * Главная страница
     *
     * @return View
     */
    public function index(): View
    {
        $news = News::select(['title', 'slug', 'image', 'short_description', 'created_at'])
            ->where('status', 'published')
            ->orderBy('created_at', 'desc')
            ->take(3)
            ->get();

        return view('home', [
           'news' => $news
        ]);
    }
}
