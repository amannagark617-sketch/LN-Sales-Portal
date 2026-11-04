# Quotation tool setup

## 1. Two new tabs in the sheet
In the Google Sheet (id 1-K_S1HXjca8dy0Sbl2qN7ts_e_YnKg5fBVSmaHB8kgU) add:
- Tab **PriceList**: File > Import > PriceList.csv (replace current sheet). 
- Tab **Terms**: File > Import > Terms.csv.
Both tabs must be readable the same way as the other tabs (the sheet is already shared for the app).
To change a price, edit the Price column. Set Active to No to hide a row. The app picks changes up within a minute (or press "Refresh prices").

## 2. Quotation Apps Script
In the existing quotation sheet add headers in columns U, V, W: `Doc Type`, `Linked Quotation`, `Status`.
In the `create-quotation-fast` handler, append `data.docType, data.linkedQuotation, data.status` to the row, after the 20 existing columns. Redeploy as a new version.
The app sends: date, quotationNumber, opfCode, brandName, clientName, mobileNumber, emailId, billingAddress, shippingAddress, subtotal, gstIncluded, freight, grandTotal, amountInWords, productsJson, salespersonId, salespersonName, docType, linkedQuotation, status.
