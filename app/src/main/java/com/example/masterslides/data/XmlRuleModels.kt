package com.example.masterslides.data

import java.util.UUID

/**
 * Represents a complete rule entry for an XML tag across different formats.
 */
data class XmlRuleEntry(
    val id: String = UUID.randomUUID().toString(),
    
    // Group A: BANK camt.052
    val iso20022Index: String = "",
    val iso20022Mult: String = "",
    val iso20022MessageElement: String = "",
    val iso20022XmlTag: String = "",
    val iso20022XmlPath: String = "",
    val isoDataType: String = "",
    val sepaCoreRequirements: String = "",
    val statusIsoEpc: String = "", // M/O/C/NA

    // Group B: STD IN
    val stdInContentRules: String = "",
    val stdInComments: String = "",

    // Group C: STD OUT
    val stdOutContentRules: String = "",
    val stdOutComments: String = "",

    // Metadata for Concurrency and Audit
    val lastUpdatedBy: String = "",
    val lastUpdatedAt: Long = System.currentTimeMillis(),
    val isLocked: Boolean = false,
    val lockedBy: String? = null,
    val lockTimestamp: Long? = null
)

/**
 * Represents a historical change made by a user.
 */
data class RuleHistory(
    val id: String = UUID.randomUUID().toString(),
    val ruleId: String,
    val userId: String,
    val userName: String,
    val timestamp: Long = System.currentTimeMillis(),
    val fieldName: String,
    val oldValue: String,
    val newValue: String
)
