@extends('layouts.admin')

@section('content')
    <div>
        <div class="d-flex justify-content-between align-items-center border-bottom pb-4 mb-4">
            <h1 class="h3">{{ $news->title }}</h1>
        </div>

        @if ($errors->any())
            <div class="alert alert-danger">
                <ul class="nav mb-0">
                    @foreach ($errors->all() as $error)
                        <li>{{ $error }}</li>
                    @endforeach
                </ul>
            </div>
        @endif

        @if(session('success'))
            <div class="alert alert-success">
                {{ session('success') }}
            </div>
        @endif


        <form id="editNewsForm" action="{{ route('admin.news.edit', $news) }}" method="POST" enctype="multipart/form-data">
            @csrf
            @method('PUT')
            <div class="mb-3">
                <label for="title" class="form-label">Заголовок</label>
                <input type="text" class="form-control" id="title" name="title" value="{{ old('title', $news->title ?? '') }}" required>
            </div>

            <div class="mb-3">
                <label for="slug" class="form-label">Slug</label>
                <input type="text" class="form-control" id="slug" name="slug" value="{{ old('slug', $news->slug ?? '') }}" required readonly>
            </div>

            <div class="mb-3">
                <label for="image" class="form-label">Изображение</label>
                <input type="file" class="form-control" id="image" name="image" accept="image/*">
                @if(isset($news->image))
                    <img src="{{ asset('storage/' . $news->image) }}" alt="Текущее изображение" class="img-thumbnail mt-2" width="200">
                @endif
            </div>

            <div class="mb-3">
                <label for="short_description" class="form-label">Краткое описание</label>
                <textarea class="form-control" id="short_description" name="short_description" rows="3" required>{{ old('short_description', $news->short_description ?? '') }}</textarea>
            </div>

            <div class="mb-3">
                <label for="description" class="form-label">Описание</label>
                <div class="bg-white"><div id="descriptionInput"></div></div>
                <input type="hidden" id="description" name="description" {{ old('description', $news->description ?? '') }}>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="status" class="form-label">Статус</label>
                        <select class="form-select" id="status" name="status" required>
                            <option value="published" {{ old('status', $news->status ?? '') === 'published' ? 'selected' : '' }}>Опубликовано</option>
                            <option value="draft" {{ old('status', $news->status ?? '') === 'draft' ? 'selected' : '' }}>Черновик</option>
                        </select>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="mb-3">
                        <label for="created_at" class="form-label">Дата публикации</label>
                        <input type="text" class="form-control" id="created_at" value="{{ $news->created_at }}" readonly>
                    </div>
                </div>
            </div>

            <div class="d-flex justify-content-between align-items-center">
                <a href="{{ route('admin.news') }}" class="btn btn-secondary">Назад</a>
                <button type="submit" class="btn btn-primary">Сохранить</button>
            </div>
        </form>
    </div>
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const quill = new Quill('#descriptionInput', {
                theme: 'snow',
                modules: {
                    toolbar: [
                        [{'header': '1'}, {'header': '2'}, {'font': []}],
                        [{'list': 'ordered'}, {'list': 'bullet'}],
                        ['bold', 'italic', 'underline'],
                        ['link'],
                        [{'align': []}],
                        ['image'],
                        ['video'],
                        [{'color': []}, {'background': []}],
                        ['clean']
                    ]
                }
            });

            quill.root.innerHTML = @json($news->description);

            document.getElementById('editNewsForm').addEventListener('submit', function (event) {
                const description = quill.root.innerHTML.trim();
                const descriptionInput = document.getElementById('description');

                if (!description || description === '<p><br></p>') {
                    alert('Описание не может быть пустым.');
                    event.preventDefault();
                    return;
                }

                descriptionInput.value = description;
            });
        });
    </script>
@endpush
