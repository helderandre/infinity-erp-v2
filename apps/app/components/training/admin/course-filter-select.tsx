// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'

interface CourseFilterSelectProps {
  value: string
  onChange: (value: string) => void
}

export function CourseFilterSelect({ value, onChange }: CourseFilterSelectProps) {
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([])

  useEffect(() => {
    fetch('/api/training/courses?status=published&limit=50')
      .then(r => r.json())
      .then(d => setCourses((d.data || []).map((c: any) => ({ id: c.id, title: c.title }))))
      .catch(() => {})
  }, [])

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="Todos os cursos" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os cursos</SelectItem>
        {courses.map(c => (
          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
