import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Send, Search, Paperclip } from 'lucide-react';
import { formatRelativeTime, getInitials } from '../../lib/utils';

interface Message {
  id: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  timestamp: string;
  read: boolean;
}

interface Conversation {
  id: string;
  participant: {
    id: string;
    name: string;
    avatar?: string;
  };
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
}

export function MessagesPage() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: conversations } = useQuery({
    queryKey: ['conversations', searchTerm],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      return apiClient.get<Conversation[] | { conversations: Conversation[] }>(
        `/messages/conversations?${params}`
      );
    },
  });
  const conversationRows: Conversation[] =
    (conversations as any)?.conversations ||
    (Array.isArray(conversations) ? (conversations as Conversation[]) : []);

  const { data: messages } = useQuery({
    queryKey: ['messages', selectedConversation],
    queryFn: () =>
      selectedConversation
        ? apiClient.get<Message[] | { messages: Message[] }>(
            `/messages/conversation/${selectedConversation}`
          )
        : Promise.resolve([] as Message[]),
    enabled: !!selectedConversation,
  });
  const messageRows: Message[] =
    (messages as any)?.messages || (Array.isArray(messages) ? (messages as Message[]) : []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
        <p className="text-gray-500 mt-1">Communicate with team members and clients</p>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-250px)]">
        {/* Conversations List */}
        <Card className="col-span-4 flex flex-col">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            <div className="space-y-2">
              {conversationRows.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedConversation === conversation.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <Avatar>
                    <AvatarImage src={conversation.participant.avatar} />
                    <AvatarFallback>
                      {getInitials(conversation.participant.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">
                        {conversation.participant.name}
                      </p>
                      <span className="text-xs text-gray-500">
                        {formatRelativeTime(conversation.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{conversation.lastMessage}</p>
                  </div>
                  {conversation.unreadCount > 0 && (
                    <Badge variant="default" className="shrink-0">
                      {conversation.unreadCount}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Messages Panel */}
        <Card className="col-span-8 flex flex-col">
          {selectedConversation ? (
            <>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage
                      src={
                        conversationRows.find((c) => c.id === selectedConversation)?.participant
                          .avatar
                      }
                    />
                    <AvatarFallback>
                      {getInitials(
                        conversationRows.find((c) => c.id === selectedConversation)?.participant
                          .name || ''
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <span>
                    {
                      conversationRows.find((c) => c.id === selectedConversation)?.participant.name
                    }
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  {messageRows.map((message) => (
                    <div
                      key={message.id}
                      className={`flex items-start gap-3 ${
                        message.sender.id === 'current-user' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={message.sender.avatar} />
                        <AvatarFallback>{getInitials(message.sender.name)}</AvatarFallback>
                      </Avatar>
                      <div
                        className={`max-w-[70%] ${
                          message.sender.id === 'current-user' ? 'text-right' : ''
                        }`}
                      >
                        <div
                          className={`inline-block rounded-lg p-3 ${
                            message.sender.id === 'current-user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatRelativeTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <div className="border-t p-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  <Input
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && messageText.trim()) {
                        setMessageText('');
                      }
                    }}
                  />
                  <Button size="icon">
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a conversation to start messaging
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default MessagesPage;
