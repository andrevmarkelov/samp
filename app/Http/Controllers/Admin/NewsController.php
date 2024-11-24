<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreNewsRequest;
use App\Http\Requests\UpdateNewsRequest;
use App\Models\News;
use Exception;
use Illuminate\Contracts\View\Factory;
use Illuminate\Contracts\View\View;
use Illuminate\Foundation\Application;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class NewsController extends Controller
{
    /**
     * Список всех новостей
     *
     * @return View
     */
    public function index(): View
    {
        $news = News::paginate(10);

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

    /**
     * Логика создание новости
     *
     * @param StoreNewsRequest $request
     * @return Response|RedirectResponse
     */
    public function store(StoreNewsRequest $request): Response|RedirectResponse
    {
        try {
            $validated = $request->validated();

            if ($request->hasFile('image')) {
                $validated['image'] = $request->file('image')->store('news_images', 'public');
            }

            News::create($validated);

            return redirect()->route('admin.news')->with('success', 'Новость успешно создана.');
        }  catch (Exception $e) {
            return response(['status' => 'error', 'response' => [$e->getMessage()]], HttpResponse::HTTP_BAD_REQUEST);
        }
    }

    /**
     * Страница с формой редактирования
     *
     * @param News $news
     * @return View|Response
     */
    public function editForm(News $news): View|Response
    {
        try {
            return view('admin.news.edit', [
              'news' => $news
            ]);
        } catch (Exception $e) {
            return response(['status' => 'error', 'response' => [$e->getMessage()]], HttpResponse::HTTP_BAD_REQUEST);
        }
    }

    /**
     * Обновление новости
     *
     * @param UpdateNewsRequest $request
     * @param News $news
     * @return Response|RedirectResponse
     */
    public function update(UpdateNewsRequest $request, News $news): Response|RedirectResponse
    {
        try {
            $validated = $request->validated();

            if ($request->hasFile('image')) {
                if ($news->image) {
                    Storage::disk('public')->delete($news->image);
                }

                $validated['image'] = $request->file('image')->store('news_images', 'public');
            }

            $news->update($validated);

            return redirect()->route('admin.news.edit.form', $news->id)->with('success', 'Новость успешно обновлена.');
        } catch (Exception $e) {
            return response(['status' => 'error', 'response' => [$e->getMessage()]], HttpResponse::HTTP_BAD_REQUEST);
        }
    }

    /**
     * Удаления новости
     *
     * @param News $news
     * @return Response|RedirectResponse
     */
    public function destroy(News $news): Response|RedirectResponse
    {
        try {
            if ($news->image) {
                Storage::disk('public')->delete($news->image);
            }

            $news->delete();

            return redirect()->route('admin.news')->with('success', 'Новость успешно удалена.');
        } catch (Exception $e) {
            return response(['status' => 'error', 'response' => [$e->getMessage()]], HttpResponse::HTTP_BAD_REQUEST);
        }
    }
}
