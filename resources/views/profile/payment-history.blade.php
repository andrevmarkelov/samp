@extends('layouts.profile')

@section('profile-content')
    <div>
        <h1 class="h3 text-center mb-3">История платежей</h1>

        <div class="table-responsive">
            <table class="table table-striped table-hover table-sm">
                <thead>
                <tr>
                    <th scope="col">#</th>
                    <th scope="col">Сумма</th>
                    <th scope="col">Статус</th>
                    <th scope="col">Дата</th>
                </tr>
                </thead>
                <tbody>
                <tr>
                    <th scope="row">1</th>
                    <td>120</td>
                    <td>Waiting</td>
                    <td>18.11.2024</td>
                </tr>
                <tr>
                    <th scope="row">2</th>
                    <td>500</td>
                    <td>Success</td>
                    <td>20.11.2024</td>
                </tr>
                <tr>
                    <th scope="row">3</th>
                    <td>380</td>
                    <td>Error</td>
                    <td>22.11.2024</td>
                </tr>
                </tbody>
            </table>
        </div>

        <nav class="d-flex justify-content-center mt-4">
            <ul class="pagination">
                <li class="page-item">
                    <a class="page-link" href="#" aria-label="Previous">
                        <span aria-hidden="true">&laquo;</span>
                    </a>
                </li>
                <li class="page-item"><a class="page-link" href="#">1</a></li>
                <li class="page-item"><a class="page-link" href="#">2</a></li>
                <li class="page-item"><a class="page-link" href="#">3</a></li>
                <li class="page-item">
                    <a class="page-link" href="#" aria-label="Next">
                        <span aria-hidden="true">&raquo;</span>
                    </a>
                </li>
            </ul>
        </nav>
    </div>
@endsection
