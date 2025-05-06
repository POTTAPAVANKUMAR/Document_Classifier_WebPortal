import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

interface DocumentResponse {
  fileName: string;
  base64Image: string;
  ocrText: string;
  aiResult: string;  // JSON string
  processedAt?: string;
}

interface AIResult {
  documentType?: string;
  entities?: string[];
  verificationSteps?: string[];
  text?: string;
  // Add other potential fields here as you discover them
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  fileName = '';
  ocrText = '';
  aiResult: AIResult = {};
  imageSrc: SafeUrl | null = null;
  loading = false;
  error = '';
  processedAt: Date | null = null;
  
  // UI state
  activeTab = 'ocr';
  showRawJson = false;

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadNextDocument();
  }

  loadNextDocument() {
    this.loading = true;
    this.error = '';
    
    this.http.get<DocumentResponse>('http://localhost:5118/api/document/next')
      .subscribe({
        next: (doc) => {
          this.fileName = doc.fileName;
          this.ocrText = doc.ocrText;
          
          // Process AI Result
          try {
            // Parse the AI result JSON string
            const parsedResult = typeof doc.aiResult === 'string' 
              ? JSON.parse(doc.aiResult) 
              : doc.aiResult;
            
            this.aiResult = parsedResult;
            
            // Also parse the OCR text if it's in JSON format
            if (this.ocrText && this.ocrText.trim().startsWith('{')) {
              try {
                const ocrJson = JSON.parse(this.ocrText);
                if (ocrJson.text) {
                  this.ocrText = ocrJson.text;
                }
              } catch (e) {
                console.log('OCR text is not valid JSON or doesn\'t contain a text field');
              }
            }
            
            // Set processedAt if available
            if (doc.processedAt) {
              this.processedAt = new Date(doc.processedAt);
            }
          } catch (e) {
            console.error('Error parsing AI result JSON:', e);
            this.error = 'Error parsing AI result data';
          }
          
          // Create safe URL from base64 image
          const imageData = `data:image/jpeg;base64,${doc.base64Image}`;
          this.imageSrc = this.sanitizer.bypassSecurityTrustUrl(imageData);
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading document:', err);
          this.error = err.status === 404 ? 'No documents available' : 'Failed to load document';
          this.loading = false;
        }
      });
  }

  markAsDone() {
    if (!this.fileName) return;
    
    this.loading = true;
    this.http.post('http://localhost:5118/api/document/complete', JSON.stringify(this.fileName), {
      headers: { 'Content-Type': 'application/json' }
    }).subscribe({
      next: () => {
        this.loadNextDocument();
      },
      error: (err) => {
        console.error('Error marking document as done:', err);
        this.error = 'Failed to mark document as done';
        this.loading = false;
      }
    });
  }
}