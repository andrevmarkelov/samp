@extends('layouts.admin')

@section('content')
    <div>
        <div class="d-flex justify-content-between align-items-center border-bottom pb-4 mb-4">
            <h1 class="h3">Личный кабинет</h1>
        </div>

        <p><strong>Имя:</strong> {{ $admin->name }}</p>
        <p><strong>Email:</strong> {{ $admin->email }}</p>
    </div>
@endsection
