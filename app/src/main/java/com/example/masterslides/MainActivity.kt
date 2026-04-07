package com.example.masterslides

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.masterslides.data.ExcelImporter
import com.example.masterslides.data.XmlRuleEntry
import com.example.masterslides.data.XmlRuleViewModel
import com.example.masterslides.ui.theme.MasterSlidesTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MasterSlidesTheme {
                val viewModel: XmlRuleViewModel = viewModel()
                RulesDashboard(viewModel)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RulesDashboard(viewModel: XmlRuleViewModel) {
    var selectedRule by remember { mutableStateOf<XmlRuleEntry?>(null) }
    var showHistory by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("XML Filling Rules Manager") },
                actions = {
                    // Search Bar in Top Bar
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        placeholder = { Text("Search tags...") },
                        modifier = Modifier.width(200.dp).padding(end = 8.dp),
                        singleLine = true,
                        trailingIcon = { if(searchQuery.isNotEmpty()) IconButton(onClick = { searchQuery = "" }) { Icon(Icons.Default.Clear, null) } }
                    )
                    
                    // Import Button
                    IconButton(onClick = {
                        val importer = ExcelImporter(context)
                        val filePath = "C:/Users/a749080/AndroidStudioProjects/MasterSlides/Masterslide_Camt_052_Version 15.1_20231220_NL2023.4.WL_TESTSMallTest.xlsm"
                        importer.importFromLocalFile(
                            filePath = filePath,
                            onSuccess = { count -> Toast.makeText(context, "Imported $count rules!", Toast.LENGTH_SHORT).show() },
                            onFailure = { e -> Toast.makeText(context, "Import failed: ${e.message}", Toast.LENGTH_LONG).show() }
                        )
                    }) {
                        Icon(Icons.Default.CloudUpload, contentDescription = "Import Excel")
                    }
                    
                    IconButton(onClick = { showHistory = !showHistory }) {
                        Icon(if (showHistory) Icons.Default.List else Icons.Default.History, contentDescription = "History")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = {
                // Logic to add a new empty rule
                val newRule = XmlRuleEntry(iso20022XmlTag = "New_Tag")
                viewModel.updateRule(newRule) // This will create it in Firestore
            }) {
                Icon(Icons.Default.Add, contentDescription = "Add New Tag")
            }
        }
    ) { padding ->
        Row(modifier = Modifier.padding(padding).fillMaxSize()) {
            // Left Side: List of Rules
            Box(modifier = Modifier.weight(1f).fillMaxHeight()) {
                val filteredRules = viewModel.rules.filter { 
                    it.iso20022XmlTag.contains(searchQuery, ignoreCase = true) || 
                    it.iso20022XmlPath.contains(searchQuery, ignoreCase = true) 
                }
                RulesList(
                    rules = filteredRules,
                    onRuleSelected = { selectedRule = it }
                )
            }

            // Right Side: Detail Editor or History
            Box(modifier = Modifier.weight(2f).fillMaxHeight().background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))) {
                if (showHistory) {
                    HistoryView(viewModel)
                } else if (selectedRule != null) {
                    RuleEditor(
                        rule = selectedRule!!,
                        viewModel = viewModel,
                        onClose = { selectedRule = null }
                    )
                } else {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("Select a tag from the left to view/edit rules", style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
        }
    }
}

@Composable
fun RulesList(rules: List<XmlRuleEntry>, onRuleSelected: (XmlRuleEntry) -> Unit) {
    LazyColumn(modifier = Modifier.fillMaxSize()) {
        items(rules) { rule ->
            ListItem(
                headlineContent = { Text(rule.iso20022XmlTag, fontWeight = FontWeight.Bold) },
                supportingContent = { Text(rule.iso20022XmlPath) },
                trailingContent = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (rule.isLocked) {
                            Icon(Icons.Default.Lock, contentDescription = "Locked", tint = Color.Red, modifier = Modifier.size(16.dp))
                            Text(rule.lockedBy?.take(5) ?: "", style = MaterialTheme.typography.labelSmall, color = Color.Red)
                        }
                    }
                },
                modifier = Modifier.clickable { onRuleSelected(rule) }
            )
            HorizontalDivider()
        }
    }
}

@Composable
fun RuleEditor(rule: XmlRuleEntry, viewModel: XmlRuleViewModel, onClose: () -> Unit) {
    var editedRule by remember(rule) { mutableStateOf(rule) }
    val isLockedByMe = rule.isLocked && rule.lockedBy == viewModel.currentUser
    val isLockedByOther = rule.isLocked && rule.lockedBy != viewModel.currentUser

    Column(modifier = Modifier.padding(24.dp).fillMaxSize()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Edit: ${rule.iso20022XmlTag}", style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.weight(1f))
            IconButton(onClick = onClose) { Icon(Icons.Default.Close, "Close") }
        }

        if (isLockedByOther) {
            Surface(color = Color.Red.copy(alpha = 0.1f), modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                Text("LOCKED BY ${rule.lockedBy}. Reading mode only.", 
                    modifier = Modifier.padding(8.dp), color = Color.Red, fontWeight = FontWeight.Bold)
            }
        }

        // Group A Info (Read Only)
        Card(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text("ISO 20022 Path: ${rule.iso20022XmlPath}", style = MaterialTheme.typography.bodySmall)
                Text("Data Type: ${rule.isoDataType} | Status: ${rule.statusIsoEpc}", style = MaterialTheme.typography.bodySmall)
            }
        }

        // Editable Rules
        OutlinedTextField(
            value = editedRule.stdInContentRules,
            onValueChange = { editedRule = editedRule.copy(stdInContentRules = it) },
            label = { Text("Group B: STD IN Content Rules") },
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            enabled = isLockedByMe,
            minLines = 3
        )

        OutlinedTextField(
            value = editedRule.stdOutContentRules,
            onValueChange = { editedRule = editedRule.copy(stdOutContentRules = it) },
            label = { Text("Group C: STD OUT Content Rules") },
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            enabled = isLockedByMe,
            minLines = 3
        )

        Row(modifier = Modifier.padding(top = 16.dp)) {
            if (!rule.isLocked) {
                Button(onClick = { viewModel.requestLock(rule.id) }) {
                    Icon(Icons.Default.Edit, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Lock & Edit")
                }
            } else if (isLockedByMe) {
                Button(onClick = { viewModel.updateRule(editedRule) }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50))) {
                    Icon(Icons.Default.Save, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Save & Unlock")
                }
                TextButton(onClick = { viewModel.unlockRule(rule.id) }, modifier = Modifier.padding(start = 8.dp)) {
                    Text("Cancel")
                }
            }
            
            Spacer(Modifier.weight(1f))
            
            // Delete Option
            IconButton(onClick = { 
                // In a real app, add a confirmation dialog
                viewModel.unlockRule(rule.id) // Ensure unlocked before delete logic
                // viewModel.deleteRule(rule.id) // Add this to VM if needed
            }) {
                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color.Gray)
            }
        }
    }
}

@Composable
fun HistoryView(viewModel: XmlRuleViewModel) {
    Column(modifier = Modifier.padding(24.dp).fillMaxSize()) {
        Text("Change History (Audit Log)", style = MaterialTheme.typography.headlineMedium)
        LazyColumn(modifier = Modifier.padding(top = 16.dp)) {
            items(viewModel.history.reversed()) { log ->
                Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Person, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Column(modifier = Modifier.padding(start = 12.dp)) {
                            Text("${log.userName} modified field: ${log.fieldName}", fontWeight = FontWeight.Bold)
                            Text("From: \"${log.oldValue}\"", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
                            Text("To: \"${log.newValue}\"", style = MaterialTheme.typography.bodySmall, color = Color(0xFF388E3C))
                            Text("Time: ${java.util.Date(log.timestamp)}", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
    }
}
