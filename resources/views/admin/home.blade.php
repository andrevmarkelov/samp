@extends('layouts.admin')

@section('content')
    <div class="row">
        <div class="col-md-12 mb-3 text-center h4">Статистика на {{ date('d.m.Y') }}</div>

        <div class="col-md-4 mb-3">
            <div class="d-flex flex-column align-items-center">
                <i class="bi bi-people-fill"></i>
                <strong>Всего пользователей</strong>
                <p>{{ $users }}</p>
            </div>
        </div>
        <div class="col-md-4 mb-3">
            <div class="d-flex flex-column align-items-center">
                <i class="bi bi-house-door-fill"></i>
                <strong>Всего домов</strong>
                <p>{{ $houses }}</p>
            </div>
        </div>
        <div class="col-md-4 mb-3">
            <div class="d-flex flex-column align-items-center">
                <i class="bi bi-briefcase-fill"></i>
                <strong>Всего бизнесов</strong>
                <p>{{ $businesses }}</p>
            </div>
        </div>
    </div>
@endsection
