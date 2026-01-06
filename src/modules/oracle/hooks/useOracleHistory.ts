import { database } from '@/db'
import OracleConversation from '@/db/models/OracleConversation'
import { Q } from '@nozbe/watermelondb'
import { withObservables } from '@nozbe/watermelondb/react'
import { useEffect, useState } from 'react'

export function useOracleHistory() {
    const [conversations, setConversations] = useState<OracleConversation[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const query = database.get<OracleConversation>('oracle_conversations')
            .query(
                Q.where('is_archived', false),
                Q.sortBy('last_message_at', Q.desc)
            )

        const subscription = query.observe().subscribe(results => {
            setConversations(results)
            setIsLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    return {
        conversations,
        isLoading
    }
}
