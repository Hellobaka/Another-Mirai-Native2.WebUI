import http from './client'
import type { ApiResponse, ChatConversation, ChatMessage, SendMessageRequest, MessageItemBase } from '@/models'

export function getConversations() {
  return http.get<ApiResponse<ChatConversation[]>>('/chat/categories')
}

export function getHistory(
  chatHistoryType: number,
  parentId: number,
  pageIndex = 1,
  pageSize = 50,
) {
  return http.get<ApiResponse<ChatMessage[]>>(
    `/chat/history?chatHistoryType=${chatHistoryType}&parentId=${parentId}&pageIndex=${pageIndex}&pageSize=${pageSize}`,
  )
}

export function sendMessage(body: SendMessageRequest) {
  return http.post<ApiResponse<{ msgId: number }>>('/chat/send', body)
}

export function getFriendNick(qq: number) {
  return http.get<ApiResponse<{ nick: string }>>(`/chat/friend-nick?qq=${qq}`)
}

export function getGroupName(groupId: number) {
  return http.get<ApiResponse<{ groupName: string }>>(`/chat/group-name?groupId=${groupId}`)
}

export function getMessage(chatHistoryType: number, parentId: number, messageId: number) {
  return http.get<ApiResponse<ChatMessage>>(
    `/chat/message?chatHistoryType=${chatHistoryType}&parentId=${parentId}&messageId=${messageId}`,
  )
}

export function clearUnread(chatHistoryType: number, parentId: number) {
  return http.post<ApiResponse<null>>(
    `/chat/clear-unread?chatHistoryType=${chatHistoryType}&parentId=${parentId}`,
  )
}

export function recallMessage(chatHistoryType: number, parentId: number, messageId: number) {
  return http.post<ApiResponse<null>>(
    `/chat/recall?chatHistoryType=${chatHistoryType}&parentId=${parentId}&messageId=${messageId}`,
  )
}

export function getCollected() {
  return http.get<ApiResponse<string[]>>('/chat/collected')
}

export function collectImage(hash: string) {
  return http.post<ApiResponse<string>>(`/chat/collect?file=${hash}`)
}

export function convertMessageChain(message: string) {
  return http.get<ApiResponse<{ message: MessageItemBase[] }>>(
    `/chat/message-chain?message=${encodeURIComponent(message)}`,
  )
}

export function uploadPicture(file: File) {
  const form = new FormData()
  form.append('file', file)
  return http.post<ApiResponse<{ item: MessageItemBase }>>('/chat/upload-picture', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
