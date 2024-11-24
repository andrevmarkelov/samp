<?php

namespace App\Http\Controllers;

use App\Models\News;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Response;

class NewsController extends Controller
{
    /**
     * Страница "Новости"
     *
     * @return View
     */
    public function index(): View
    {
        $news = News::select(['title', 'slug', 'short_description', 'image', 'created_at'])
            ->where('status', 'published')
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        return view('news.index', [
            'news' => $news
        ]);
    }

    /**
     * Страница новости по слагу
     *
     * @param string $slug
     * @return View|Response
     */
    public function show(string $slug): View|Response
    {
        $news = News::where('slug', $slug)
            ->where('status', 'published')
            ->firstOrFail();

        return view('news.show', compact('news'));
    }
}
