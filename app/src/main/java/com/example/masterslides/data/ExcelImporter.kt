package com.example.masterslides.data

import android.content.Context
import android.net.Uri
import com.google.firebase.firestore.FirebaseFirestore
import org.apache.poi.ss.usermodel.WorkbookFactory
import java.io.File
import java.io.FileInputStream
import java.util.UUID

class ExcelImporter(private val context: Context) {
    private val db = FirebaseFirestore.getInstance()

    fun importFromLocalFile(filePath: String, onSuccess: (Int) -> Unit, onFailure: (Exception) -> Unit) {
        try {
            val file = File(filePath)
            val inputStream = FileInputStream(file)
            val workbook = WorkbookFactory.create(inputStream)
            val sheet = workbook.getSheetAt(0) // Assuming data is in the first sheet

            val entries = mutableListOf<XmlRuleEntry>()

            // Skip header row (index 0)
            for (rowIndex in 1..sheet.lastRowNum) {
                val row = sheet.getRow(rowIndex) ?: continue
                
                // Helper to get string value safely
                fun getCellString(index: Int): String {
                    return row.getCell(index)?.toString() ?: ""
                }

                val entry = XmlRuleEntry(
                    id = UUID.randomUUID().toString(),
                    // Group A
                    iso20022Index = getCellString(0),
                    iso20022Mult = getCellString(1),
                    iso20022MessageElement = getCellString(2),
                    iso20022XmlTag = getCellString(3),
                    iso20022XmlPath = getCellString(4),
                    isoDataType = getCellString(5),
                    sepaCoreRequirements = getCellString(6),
                    statusIsoEpc = getCellString(7),
                    // Group B
                    stdInContentRules = getCellString(8),
                    stdInComments = getCellString(9),
                    // Group C
                    stdOutContentRules = getCellString(10),
                    stdOutComments = getCellString(11)
                )
                
                // Only add if it has an XML tag (basic validation)
                if (entry.iso20022XmlTag.isNotBlank()) {
                    entries.add(entry)
                }
            }

            // Batch upload to Firestore
            val batch = db.batch()
            entries.forEach { entry ->
                val docRef = db.collection("rules").document(entry.id)
                batch.set(docRef, entry)
            }

            batch.commit()
                .addOnSuccessListener { onSuccess(entries.size) }
                .addOnFailureListener { onFailure(it) }

            workbook.close()
            inputStream.close()

        } catch (e: Exception) {
            onFailure(e)
        }
    }
}
