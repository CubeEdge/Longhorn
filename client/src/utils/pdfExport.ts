import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFExportOptions {
    filename: string;
    element: HTMLElement;
    orientation?: 'portrait' | 'landscape';
    format?: 'a4' | 'letter';
    method?: 'canvas' | 'print'; // canvas=截图式, print=浏览器打印(文字版)
}

// 使用浏览器打印API生成文字版PDF
export async function exportToPDFViaPrint(options: PDFExportOptions): Promise<void> {
    const { filename, element, orientation = 'portrait', format = 'a4' } = options;

    // 创建打印窗口
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('无法打开打印窗口，请检查浏览器弹窗设置');
        return;
    }

    // 构建打印页面
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${filename}</title>
    <style>
        @page {
            size: ${format} ${orientation};
            margin: 15mm;
        }
        * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
        }
        body {
            margin: 0;
            padding: 20px;
            font-family: 'PingFang SC', 'Microsoft YaHei', 'SimHei', 'Helvetica Neue', Arial, sans-serif;
            background: #fff;
            color: #000;
        }
        /* 确保所有颜色在打印时显示 */
        .print-content {
            background: #fff !important;
        }
        .print-content * {
            color: inherit !important;
        }
    </style>
</head>
<body>
    <div class="print-content">
        ${element.innerHTML}
    </div>
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
                window.close();
            }, 500);
        };
    </script>
</body>
</html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
}

// 使用Canvas截图方式生成PDF（保留原有方式作为备选）
export async function exportToPDFViaCanvas(options: PDFExportOptions): Promise<void> {
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

// 主导出函数 - 默认使用浏览器打印方式
export async function exportToPDF(options: PDFExportOptions): Promise<void> {
    const method = options.method || 'print';
    
    if (method === 'print') {
        await exportToPDFViaPrint(options);
    } else {
        await exportToPDFViaCanvas(options);
    }
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
