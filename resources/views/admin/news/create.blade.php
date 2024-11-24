@extends('layouts.admin')

@section('content')
    <div>
        <div class="d-flex justify-content-between align-items-center border-bottom pb-4 mb-4">
            <h1 class="h3">Создание новости</h1>
        </div>

        <form method="POST" enctype="multipart/form-data">
            @csrf
            <div class="mb-3">
                <label for="title" class="form-label">Заголовок</label>
                <input type="text" class="form-control" id="title" name="title" required>
            </div>

            <div class="mb-3">
                <label for="slug" class="form-label">Slug</label>
                <input type="text" class="form-control" id="slug" name="slug" required readonly>
            </div>

            <div class="mb-3">
                <label for="image" class="form-label">Изображение</label>
                <input type="file" class="form-control" id="image" name="image" accept="image/*" required>
            </div>

            <div class="mb-3">
                <label for="short_description" class="form-label">Краткое описание</label>
                <textarea class="form-control" id="short_description" name="short_description" rows="3" required></textarea>
            </div>

            <div class="mb-3">
                <label for="description" class="form-label">Описание</label>
                <div class="bg-white"><div id="description"></div></div>
                <input type="hidden" name="description" id="description-input">
            </div>

            <div class="mb-3">
                <label for="status" class="form-label">Статус</label>
                <select class="form-select" id="status" name="status" required>
                    <option value="1">Опубликовано</option>
                    <option value="0">Черновик</option>
                </select>
            </div>

            <div class="d-flex justify-content-between align-items-center">
                <a href="{{ route('admin.news') }}" class="btn btn-secondary">Назад</a>
                <button type="submit" class="btn btn-primary">Создать новость</button>
            </div>
        </form>
    </div>
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const quill = new Quill('#description', {
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

            function transliterate(str) {
                const map = {
                    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'I', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ы': 'Y', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
                    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ы': 'y', 'э': 'e', 'ю': 'yu', 'я': 'ya',
                    ' ': '-', 'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'æ': 'ae', 'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ð': 'd', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ý': 'y', 'ÿ': 'y'
                };

                return str.split('').map(function(char) {
                    return map[char] || char;
                }).join('');
            }

            function cleanSlug(slug) {
                return slug.toLowerCase()
                    .replace(/[^a-z0-9-]/g, '')
                    .replace(/-+/g, '-')
                    .replace(/^-+/, '')
                    .replace(/-+$/, '');
            }

            const form = document.querySelector('form');
            form.onsubmit = function() {
                const description = document.querySelector('#description-input');
                description.value = quill.root.innerHTML;
            };

            document.getElementById('title').addEventListener('input', function() {
                const title = this.value;
                const slug = transliterate(title);

                document.getElementById('slug').value = cleanSlug(slug);
            });
        });
    </script>
@endpush
