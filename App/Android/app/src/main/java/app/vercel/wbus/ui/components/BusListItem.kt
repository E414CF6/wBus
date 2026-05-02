package app.vercel.wbus.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.DirectionsBus
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

@Composable
fun BusListItem(
    plateNumber: String, currentStation: String?, direction: Int?, // 1: 상행, 0: 하행
    onClick: () -> Unit = {}, modifier: Modifier = Modifier
) {
    val directionColor = if (direction == 1) Color(0xFFFF5252) else Color(0xFF448AFF)
    val directionText = if (direction == 1) "상행" else "하행"

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        shape = RoundedCornerShape(20.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically
            ) {
                // Bus Icon Container
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(directionColor.copy(alpha = 0.1f)), contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.DirectionsBus,
                        contentDescription = "Bus",
                        tint = directionColor,
                        modifier = Modifier.size(24.dp)
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column(modifier = Modifier.weight(1f)) {
                    // Plate Number as Title
                    Text(
                        text = plateNumber,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    Row(
                        verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)
                    ) {
                        Surface(
                            color = directionColor.copy(alpha = 0.1f), shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                text = directionText,
                                color = directionColor,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // Current Station Name as Pill (Right Side)
            Surface(
                modifier = Modifier
                    .padding(start = 12.dp)
                    .clip(RoundedCornerShape(12.dp)),
                color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.7f),
            ) {
                Text(
                    text = currentStation ?: "위치 정보 없음",
                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}
