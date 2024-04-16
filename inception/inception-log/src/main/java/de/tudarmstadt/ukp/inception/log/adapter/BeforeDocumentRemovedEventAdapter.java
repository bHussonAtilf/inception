/*
 * Licensed to the Technische Universität Darmstadt under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The Technische Universität Darmstadt 
 * licenses this file to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.
 *  
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package de.tudarmstadt.ukp.inception.log.adapter;

import org.springframework.stereotype.Component;

import de.tudarmstadt.ukp.inception.documents.event.BeforeDocumentRemovedEvent;

@Component
public class BeforeDocumentRemovedEventAdapter
    implements EventLoggingAdapter<BeforeDocumentRemovedEvent>
{
    @Override
    public boolean accepts(Class<?> aEvent)
    {
        return BeforeDocumentRemovedEvent.class.isAssignableFrom(aEvent);
    }

    @Override
    public long getDocument(BeforeDocumentRemovedEvent aEvent)
    {
        return aEvent.getDocument().getId();
    }

    @Override
    public long getProject(BeforeDocumentRemovedEvent aEvent)
    {
        return aEvent.getDocument().getProject().getId();
    }
}
