@extends('layouts.admin')

@section('content')
    <div class="row">
        <h1 class="h5 text-center mb-3">Общая статистика на {{ date('d.m.Y') }}</h1>

        <div class="col-md-3 mb-3">
            <div class="d-flex flex-column align-items-center">
                <i class="bi bi-people-fill h3"></i>
                <strong>Всего пользователей</strong>
                <p>{{ $users }}</p>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="d-flex flex-column align-items-center">
                <i class="bi bi-house-door-fill h3"></i>
                <strong>Всего домов</strong>
                <p>{{ $houses }}</p>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="d-flex flex-column align-items-center">
                <i class="bi bi-briefcase-fill h3"></i>
                <strong>Всего бизнесов</strong>
                <p>{{ $businesses }}</p>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="d-flex flex-column align-items-center">
                <i class="bi bi-wallet-fill h3"></i>
                <strong>Доход</strong>
                <p>{{ number_format($totalRevenue, 2, '.', ' ') }} ₽</p>
            </div>
        </div>
    </div>
@endsection
