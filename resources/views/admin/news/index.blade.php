@extends('layouts.admin')

@section('content')
    <div>
        <div class="d-flex justify-content-between align-items-center border-bottom pb-4">
            <h1 class="h3">Новости</h1>
            <a href="{{ route('admin.news.create.form') }}" class="btn btn-success">Создать новость</a>
        </div>
    </div>
@endsection
