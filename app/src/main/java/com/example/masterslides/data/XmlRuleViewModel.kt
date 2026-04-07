package com.example.masterslides.data

import androidx.compose.runtime.mutableStateListOf
import androidx.lifecycle.ViewModel
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.ktx.toObject
import java.util.UUID

class XmlRuleViewModel : ViewModel() {
    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()
    
    // Current user context (Mocking a login or using Firebase Auth)
    val currentUser = auth.currentUser?.email ?: ("User_" + UUID.randomUUID().toString().take(4))

    private val _rules = mutableStateListOf<XmlRuleEntry>()
    val rules: List<XmlRuleEntry> get() = _rules

    private val _history = mutableStateListOf<RuleHistory>()
    val history: List<RuleHistory> get() = _history

    private var rulesListener: ListenerRegistration? = null
    private var historyListener: ListenerRegistration? = null

    init {
        observeRules()
        observeHistory()
    }

    private fun observeRules() {
        rulesListener = db.collection("rules")
            .addSnapshotListener { snapshot, e ->
                if (e != null) return@addSnapshotListener
                if (snapshot != null) {
                    _rules.clear()
                    for (doc in snapshot) {
                        doc.toObject<XmlRuleEntry>()?.let { _rules.add(it) }
                    }
                }
            }
    }

    private fun observeHistory() {
        historyListener = db.collection("history")
            .orderBy("timestamp")
            .addSnapshotListener { snapshot, e ->
                if (e != null) return@addSnapshotListener
                if (snapshot != null) {
                    _history.clear()
                    for (doc in snapshot) {
                        doc.toObject<RuleHistory>()?.let { _history.add(it) }
                    }
                }
            }
    }

    fun requestLock(ruleId: String) {
        val ruleRef = db.collection("rules").document(ruleId)
        db.runTransaction { transaction ->
            val snapshot = transaction.get(ruleRef)
            val currentLocked = snapshot.getBoolean("isLocked") ?: false
            val currentLockedBy = snapshot.getString("lockedBy")

            if (!currentLocked || currentLockedBy == currentUser) {
                transaction.update(ruleRef, "isLocked", true)
                transaction.update(ruleRef, "lockedBy", currentUser)
                transaction.update(ruleRef, "lockTimestamp", System.currentTimeMillis())
            } else {
                throw Exception("Tag is already locked by $currentLockedBy")
            }
        }.addOnFailureListener {
            // Handle error (e.g., show a toast that lock failed)
        }
    }

    fun updateRule(updatedRule: XmlRuleEntry) {
        val ruleRef = db.collection("rules").document(updatedRule.id)
        
        // Use a transaction to ensure atomic update and unlock
        db.runTransaction { transaction ->
            val oldSnapshot = transaction.get(ruleRef)
            val oldRule = oldSnapshot.toObject<XmlRuleEntry>() ?: return@runTransaction

            // Save History
            generateHistoryInTransaction(transaction, oldRule, updatedRule)

            // Update Rule and Unlock
            transaction.set(ruleRef, updatedRule.copy(
                isLocked = false,
                lockedBy = null,
                lockTimestamp = null,
                lastUpdatedBy = currentUser,
                lastUpdatedAt = System.currentTimeMillis()
            ))
        }
    }

    private fun generateHistoryInTransaction(transaction: com.google.firebase.firestore.Transaction, old: XmlRuleEntry, new: XmlRuleEntry) {
        val historyRef = db.collection("history").document()
        
        // Check for field changes and record them
        if (old.stdInContentRules != new.stdInContentRules) {
            val log = RuleHistory(
                ruleId = old.id,
                userId = currentUser,
                userName = currentUser,
                fieldName = "STD IN Content Rules",
                oldValue = old.stdInContentRules,
                newValue = new.stdInContentRules
            )
            transaction.set(historyRef, log)
        }
        
        if (old.stdOutContentRules != new.stdOutContentRules) {
            val log = RuleHistory(
                ruleId = old.id,
                userId = currentUser,
                userName = currentUser,
                fieldName = "STD OUT Content Rules",
                oldValue = old.stdOutContentRules,
                newValue = new.stdOutContentRules
            )
            transaction.set(historyRef, log)
        }
    }

    fun unlockRule(ruleId: String) {
        db.collection("rules").document(ruleId)
            .update("isLocked", false, "lockedBy", null)
    }

    override fun onCleared() {
        super.onCleared()
        rulesListener?.remove()
        historyListener?.remove()
    }
}
