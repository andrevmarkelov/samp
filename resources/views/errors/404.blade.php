@extends('layouts.app')

@section('content')
    <div class="container py-5 min-vh-100">
        <div class="row justify-content-center">
            <div class="col-md-5">
                <img src="{{ asset('assets/images/404.webp') }}" alt="404" class="w-100 mb-5 rounded-4">

                <h1 class="h3 color-dark-blue text-center mb-2">Страница не найдена</h1>
                <p class="color-grey text-center">К сожалению, страница, которую вы ищете, не существует. Проверьте правильность введённого адреса или
                    перейдите на</p>
                <div class="d-flex justify-content-center">
                    <a href="{{ route('home') }}" class="btn-default">Главную страницу</a>
                </div>
            </div>
        </div>
    </div>
@endsection
