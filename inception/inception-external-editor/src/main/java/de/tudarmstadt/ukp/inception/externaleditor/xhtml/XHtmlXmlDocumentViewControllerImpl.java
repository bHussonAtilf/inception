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
package de.tudarmstadt.ukp.inception.externaleditor.xhtml;

import static java.lang.invoke.MethodHandles.lookup;
import static org.apache.commons.lang3.StringUtils.substringAfter;
import static org.slf4j.LoggerFactory.getLogger;
import static org.springframework.http.HttpStatus.OK;

import java.io.FileNotFoundException;
import java.io.StringWriter;
import java.security.Principal;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

import javax.servlet.ServletContext;
import javax.servlet.http.HttpServletRequest;

import org.apache.uima.cas.CAS;
import org.dkpro.core.api.xml.type.XmlDocument;
import org.dkpro.core.api.xml.type.XmlElement;
import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.xml.sax.ContentHandler;
import org.xml.sax.SAXException;
import org.xml.sax.helpers.AttributesImpl;

import de.tudarmstadt.ukp.clarin.webanno.api.DocumentImportExportService;
import de.tudarmstadt.ukp.clarin.webanno.api.DocumentService;
import de.tudarmstadt.ukp.clarin.webanno.model.SourceDocument;
import de.tudarmstadt.ukp.clarin.webanno.support.wicket.ServletContextUtils;
import de.tudarmstadt.ukp.inception.editor.AnnotationEditorRegistry;
import de.tudarmstadt.ukp.inception.externaleditor.XmlDocumentViewControllerImplBase;
import de.tudarmstadt.ukp.inception.externaleditor.policy.DefaultHtmlDocumentPolicy;
import de.tudarmstadt.ukp.inception.externaleditor.policy.SafetyNetDocumentPolicy;
import de.tudarmstadt.ukp.inception.externaleditor.xml.XmlCas2SaxEvents;
import de.tudarmstadt.ukp.inception.io.xml.dkprocore.Cas2SaxEvents;

@ConditionalOnWebApplication
@RestController
@RequestMapping(XHtmlXmlDocumentViewController.BASE_URL)
public class XHtmlXmlDocumentViewControllerImpl
    extends XmlDocumentViewControllerImplBase
    implements XHtmlXmlDocumentViewController
{
    private static final Logger LOG = getLogger(lookup().lookupClass());

    private static final String RESOURCE_ELEMENT = "/res/";
    private static final String GET_DOCUMENT_PATH = "/p/{projectId}/d/{documentId}/xml";
    private static final String GET_RESOURCE_PATH = "/p/{projectId}/d/{documentId}"
            + RESOURCE_ELEMENT + "**";

    private static final String XHTML_NS_URI = "http://www.w3.org/1999/xhtml";
    private static final String HTML = "html";
    private static final String BODY = "body";
    private static final String HEAD = "head";

    private final DocumentService documentService;
    private final DocumentImportExportService formatRegistry;
    private final ServletContext servletContext;

    @Autowired
    public XHtmlXmlDocumentViewControllerImpl(DocumentService aDocumentService,
            AnnotationEditorRegistry aAnnotationEditorRegistry, ServletContext aServletContext,
            DocumentImportExportService aFormatRegistry, DefaultHtmlDocumentPolicy aDefaultPolicy,
            SafetyNetDocumentPolicy aSafetyNetPolicy)
    {
        super(aDefaultPolicy, aSafetyNetPolicy, aFormatRegistry, aAnnotationEditorRegistry);

        documentService = aDocumentService;
        servletContext = aServletContext;
        formatRegistry = aFormatRegistry;
    }

    @Override
    public String getDocumentUrl(SourceDocument aDoc)
    {
        return servletContext.getContextPath() + BASE_URL + GET_DOCUMENT_PATH //
                .replace("{projectId}", String.valueOf(aDoc.getProject().getId()))
                .replace("{documentId}", String.valueOf(aDoc.getId()));
    }

    private void renderXmlStylesheet(ContentHandler ch, String aStylesheetUrl) throws SAXException
    {
        AttributesImpl attr = new AttributesImpl();
        attr.addAttribute(null, null, "rel", null, "stylesheet");
        attr.addAttribute(null, null, "type", null, "text/css");
        attr.addAttribute(null, null, "href", null, aStylesheetUrl);
        ch.startElement(null, null, "link", attr);
        ch.endElement(null, null, "link");
    }

    @PreAuthorize("@documentAccess.canViewAnnotationDocument(#aProjectId, #aDocumentId, #principal.name)")
    @Override
    @GetMapping(path = GET_DOCUMENT_PATH)
    public ResponseEntity<String> getDocument(@PathVariable("projectId") long aProjectId,
            @PathVariable("documentId") long aDocumentId,
            @RequestParam("editor") Optional<String> aEditor, Principal principal)
        throws Exception
    {
        SourceDocument doc = documentService.getSourceDocument(aProjectId, aDocumentId);

        CAS cas = documentService.createOrReadInitialCas(doc);

        try (StringWriter out = new StringWriter()) {
            Optional<XmlDocument> maybeXmlDocument;
            if (cas.getTypeSystem().getType(XmlDocument._TypeName) != null) {
                maybeXmlDocument = cas.select(XmlDocument.class).findFirst();
            }
            else {
                maybeXmlDocument = Optional.empty();
            }

            var casContainsHtml = maybeXmlDocument.map(XmlDocument::getRoot) //
                    .map(XmlElement::getQName) //
                    .map(qname -> HTML.equals(qname.toLowerCase(Locale.ROOT))) //
                    .orElse(false);

            ContentHandler ch = XmlCas2SaxEvents.makeSerializer(out);

            // If the CAS contains an actual HTML structure, then we send that. Mind that we do
            // not inject format-specific CSS then!
            if (casContainsHtml) {
                XmlDocument xml = maybeXmlDocument.get();
                Cas2SaxEvents serializer = new XmlCas2SaxEvents(xml, ch);
                ch.startDocument();
                ch.startPrefixMapping("", XHTML_NS_URI);
                serializer.process(xml.getRoot());
                ch.endPrefixMapping("");
                ch.endDocument();
                return toResponse(out);
            }

            ch.startDocument();
            ch.startPrefixMapping("", XHTML_NS_URI);
            ch.startElement(null, null, HTML, null);
            ch.startElement(null, null, HEAD, null);
            for (String cssUrl : formatRegistry.getFormatCssStylesheets(doc).stream()
                    .map(css -> ServletContextUtils.referenceToUrl(servletContext, css))
                    .collect(Collectors.toList())) {
                renderXmlStylesheet(ch, cssUrl);
            }

            ch.endElement(null, null, HEAD);
            ch.startElement(null, null, BODY, null);

            if (maybeXmlDocument.isEmpty()) {
                // Gracefully handle the case that the CAS does not contain any XML structure at all
                // and show only the document text in this case.
                String text = cas.getDocumentText();
                ch.characters(text.toCharArray(), 0, text.length());
            }
            else {
                XmlDocument xml = maybeXmlDocument.get();
                var sh = applySanitizers(aEditor, doc, ch);
                Cas2SaxEvents serializer = new XmlCas2SaxEvents(xml, sh);
                serializer.process(xml.getRoot());
            }

            ch.endElement(null, null, BODY);
            ch.endElement(null, null, HTML);
            ch.endPrefixMapping("");
            ch.endDocument();

            return toResponse(out);
        }
    }

    @PreAuthorize("@documentAccess.canViewAnnotationDocument(#aProjectId, #aDocumentId, #principal.name)")
    @Override
    @GetMapping(path = GET_RESOURCE_PATH)
    public ResponseEntity<InputStreamResource> getResource(
            @PathVariable("projectId") long aProjectId,
            @PathVariable("documentId") long aDocumentId, HttpServletRequest aRequest,
            Principal principal)
        throws Exception
    {
        var srcDoc = documentService.getSourceDocument(aProjectId, aDocumentId);

        var maybeFormatSupport = formatRegistry.getFormatById(srcDoc.getFormat());
        if (!maybeFormatSupport.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        var srcDocFile = documentService.getSourceDocumentFile(srcDoc);
        var path = aRequest.getServletPath();
        var resource = substringAfter(path, RESOURCE_ELEMENT);

        var formatSupport = maybeFormatSupport.get();

        try {
            var inputStream = formatSupport.openResourceStream(srcDocFile, resource);
            HttpHeaders httpHeaders = new HttpHeaders();
            return new ResponseEntity<>(new InputStreamResource(inputStream), httpHeaders, OK);
        }
        catch (FileNotFoundException e) {
            LOG.error("Resource [{}] for document {} not found", resource, srcDoc);
            return ResponseEntity.notFound().build();
        }
        catch (Exception e) {
            LOG.error("Unable to load resource [{}] for document {}", resource, srcDoc, e);
            return ResponseEntity.notFound().build();
        }
    }

    private ResponseEntity<String> toResponse(StringWriter aOut)
    {
        return ResponseEntity.ok() //
                .contentType(MediaType.APPLICATION_XHTML_XML) //
                .body(aOut.toString());
    }
}
