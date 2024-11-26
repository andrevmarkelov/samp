<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Models\House;
use Illuminate\Contracts\View\View;

class MapController extends Controller
{
    /**
     * Страница карты в личном кабинете
     *
     * @return View
     */
    public function index(): View
    {
        $houses = House::with('user:id,username')
            ->select('id', 'name', 'description', 'price', 'entrance_x', 'entrance_y', 'user_id')
            ->get();

        $business = Business::with('user:id,username')
            ->select('id', 'name', 'description', 'price', 'entrance_x', 'entrance_y', 'user_id')
            ->get();

        return view('profile.map', [
            'houses' => $houses ?? [],
            'business' => $business ?? []
        ]);
    }
}
