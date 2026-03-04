// core/services/expenditure.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.prod';
import {
    Expenditure,
    CreateExpenditureDto,
    UpdateExpenditureDto,
} from '../models/expenditure';

interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

@Injectable({ providedIn: 'root' })
export class ExpenditureService {

    private readonly base = `${environment.apiUrl}/expenditures`;

    constructor(private http: HttpClient) { }

    getAll(): Observable<ApiResponse<Expenditure[]>> {
        return this.http.get<ApiResponse<Expenditure[]>>(this.base);
    }

    getById(id: string): Observable<ApiResponse<Expenditure>> {
        return this.http.get<ApiResponse<Expenditure>>(`${this.base}/${id}`);
    }

    create(dto: CreateExpenditureDto): Observable<ApiResponse<Expenditure>> {
        return this.http.post<ApiResponse<Expenditure>>(this.base, dto);
    }

    update(id: string, dto: UpdateExpenditureDto): Observable<ApiResponse<Expenditure>> {
        return this.http.put<ApiResponse<Expenditure>>(`${this.base}/${id}`, dto);
    }

    delete(id: string): Observable<ApiResponse<void>> {
        return this.http.delete<ApiResponse<void>>(`${this.base}/${id}`);
    }
}