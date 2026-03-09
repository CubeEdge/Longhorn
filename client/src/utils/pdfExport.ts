import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PDFExportOptions {
    filename: string;
    element: HTMLElement;
    orientation?: 'portrait' | 'landscape';
    format?: 'a4' | 'letter';
}

export async function exportToPDF(options: PDFExportOptions): Promise<void> {
    const { filename, element, orientation = 'portrait', format = 'a4' } = options;

    const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    let imgY = 10;

    const scaledHeight = imgHeight * ratio;

    if (scaledHeight > pdfHeight - 20) {
        let heightLeft = scaledHeight;
        let position = imgY;

        pdf.addImage(imgData, 'PNG', imgX, position, pdfWidth - 20, scaledHeight);
        heightLeft -= pdfHeight - 20;

        while (heightLeft > 0) {
            position = heightLeft - scaledHeight + 10;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', imgX, position, pdfWidth - 20, scaledHeight);
            heightLeft -= pdfHeight - 20;
        }
    } else {
        pdf.addImage(imgData, 'PNG', imgX, imgY, pdfWidth - 20, scaledHeight);
    }

    pdf.save(filename);
}

export function generatePINumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PI-RMA-${dateStr}-${random}`;
}

export function generateReportNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `RR-${dateStr}-${random}`;
}
