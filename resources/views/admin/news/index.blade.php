@extends('layouts.admin')

@section('content')
    <div>
        <div class="d-flex justify-content-between align-items-center border-bottom pb-4 mb-4">
            <h1 class="h3">Новости</h1>
            <a href="{{ route('admin.news.create.form') }}" class="btn btn-success">Создать новость</a>
        </div>

        @if(session('success'))
            <div class="alert alert-success">
                {{ session('success') }}
            </div>
        @endif

        <div class="table-responsive">
            <table class="table table-bordered table-hover ">
                <thead>
                <tr>
                    <th>ID</th>
                    <th>Заголовок</th>
                    <th>Статус</th>
                    <th>Дата публикации</th>
                    <th>Действия</th>
                </tr>
                </thead>
                <tbody>
                @foreach ($news as $item)
                    <tr>
                        <td>{{ $item->id }}</td>
                        <td>{{ $item->title }}</td>
                        <td>
                            @if($item->status === 'published')
                                <div class="d-inline m-0 p-1 alert alert-success" role="alert">Опубликован</div>
                            @else
                                <div class="d-inline m-0 p-1 alert alert-secondary" role="alert">Черновик</div>
                            @endif
                        </td>
                        <td>{{ $item->created_at->format('d.m.Y') }}</td>
                        <td>
                            <a href="{{ route('admin.news.edit.form', $item->id) }}" class="text-primary-emphasis text-decoration-none" title="Редактировать">
                                <i class="bi bi-pencil-square"></i>
                            </a>
                            <form action="{{ route('admin.news.destroy', $item->id) }}" method="POST" class="d-inline">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="text-danger border-0 bg-transparent" onclick="return confirm('Вы уверены?')" title="Удалить">
                                    <i class="bi bi-trash3"></i>
                                </button>
                            </form>
                            <a href="{{ route('news.show', $item->slug) }}" target="_blank" title="Перейти">
                                <i class="bi bi-box-arrow-up-right"></i>
                            </a>
                        </td>
                    </tr>
                @endforeach
                </tbody>
            </table>
        </div>
    </div>
@endsection
